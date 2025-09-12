import { App, TFile, Notice, Plugin } from 'obsidian';
import { NoteService } from '../noteService';
import { ContextFieldManager } from '../components/modalComponents';
import { ContextEntry, SeeYouAgainFrontmatter, SeeYouAgainSettings } from '../types';
import { BaseNoteModal } from '../utils/baseModal';
import { ContextUtils } from '../utils/contextUtils';

interface SearchView {
	dom: {
		getFiles(): TFile[];
	};
}

export class BatchAddContextModal extends BaseNoteModal {
	private noteService: NoteService;
	private contextFieldManager: ContextFieldManager | null = null;
	private searchResults: TFile[] = [];

	constructor(app: App, plugin: Plugin & { settings: SeeYouAgainSettings; saveSettings(): Promise<void> }) {
		super(app, plugin);
		this.noteService = new NoteService(app);
	}

	async onOpen(): Promise<void> {
		super.onOpen(); // This applies the see-you-again-modal class
		await this.loadSearchResults();
	}

	onClose(): void {
		// Clean up autocomplete instances
		this.contextFieldManager?.destroy();
		this.contextFieldManager = null;
		
		super.onClose();
	}

	private async loadSearchResults(): Promise<void> {
		try {
			// Get search results from the search view
			const searchLeaf = this.app.workspace.getLeavesOfType('search')[0];
			if (!searchLeaf || !searchLeaf.view) {
				this.showNoSearchMessage('The core search plugin is not enabled');
				return;
			}
			const searchView = searchLeaf.view as unknown as SearchView;
			
			if (!searchView) {
				this.showNoSearchMessage('The core search plugin is not enabled');
				return;
			}

			const searchResults = searchView.dom.getFiles();
			
			if (!searchResults || searchResults.length === 0) {
				this.showNoSearchMessage('No search results available');
				return;
			}

			// Filter to only include markdown files
			this.searchResults = searchResults.filter(file => file.extension === 'md');

			if (this.searchResults.length === 0) {
				this.showNoSearchMessage('No markdown files in search results');
				return;
			}

			await this.renderModal();
		} catch (error) {
			console.error('Error loading search results:', error);
			this.showError('Error loading search results. Please try again.');
		}
	}

	private showNoSearchMessage(message: string): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: 'No Search Results' });
		contentEl.createEl('p', { text: message });
		
		const buttonContainer = contentEl.createEl('div');
		buttonContainer.className = 'modal-button-row';
		
		const closeButton = this.createStyledButton('Close', () => this.close());
		buttonContainer.appendChild(closeButton);
	}

	private async renderModal(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();

		// Header
		this.createHeader(`Batch Add Contexts`);

		// Info section
		const infoContainer = contentEl.createEl('div');
		infoContainer.className = 'batch-modal-info';
		infoContainer.createEl('p', { 
			text: `Applying contexts to ${this.searchResults.length} notes from current search results.`
		});

		// Context fields container
		const fieldsContainer = contentEl.createEl('div');
		fieldsContainer.className = 'modal-fields-container';

		// Initialize field manager
		this.contextFieldManager = new ContextFieldManager(this.app, fieldsContainer, (entries: ContextEntry[]) => {
			this.updateButtonStates();
		});

		// Load past contexts asynchronously
		this.loadPastContextsAsync();

		// Buttons container
		const buttonsContainer = contentEl.createEl('div');
		buttonsContainer.className = 'modal-button-row';

		// Create buttons directly in the row
		const cancelButton = this.createStyledButton('Cancel', () => this.close());
		const applyButton = this.createStyledButton('Apply to All Notes', () => this.handleBatchSave());
		applyButton.id = 'batch-apply-button';
		
		buttonsContainer.appendChild(cancelButton);
		buttonsContainer.appendChild(applyButton);

		// Update button states
		this.updateButtonStates();
	}

	private updateButtonStates(): void {
		const applyButton = this.contentEl.querySelector('#batch-apply-button') as HTMLButtonElement;
		if (applyButton) {
			const isValid = this.contextFieldManager?.hasValidEntries() || false;
			applyButton.disabled = !isValid;
			applyButton.style.opacity = isValid ? '1' : '0.5';
			applyButton.style.cursor = isValid ? 'pointer' : 'not-allowed';
		}
	}

	private async handleBatchSave(): Promise<void> {
		if (!this.contextFieldManager) return;

		const entries = this.contextFieldManager.getEntries();
		if (entries.length === 0) {
			this.showError('Please add at least one context before applying.');
			return;
		}

		const applyButton = this.contentEl.querySelector('#batch-apply-button') as HTMLButtonElement;
		if (!applyButton) return;

		try {
			// Disable button and show initial progress
			applyButton.disabled = true;
			applyButton.textContent = 'Processing 0%';

			// Prepare metadata object
			const metadata: SeeYouAgainFrontmatter = {};
			entries.forEach(entry => {
				const sanitizedKey = ContextUtils.sanitizeContextKey(entry.context);
				metadata[sanitizedKey] = entry.action;
			});

			let successCount = 0;
			const errors: string[] = [];
			const total = this.searchResults.length;

			// Apply contexts to all notes in search results
			for (let i = 0; i < this.searchResults.length; i++) {
				const note = this.searchResults[i];
				const progress = Math.round(((i + 1) / total) * 100);
				
				// Update button text with progress
				applyButton.textContent = `Processing ${progress}%`;

				try {
					// Get existing frontmatter
					const existingFrontmatter = await this.noteService.getFrontmatter(note);
					
					// Merge with new contexts (new contexts will be added on top/overwrite existing)
					const updatedMetadata = { ...existingFrontmatter, ...metadata };
					
					await this.noteService.saveMetadata(note, updatedMetadata);
					successCount++;
				} catch (error) {
					console.error(`Error updating note ${note.path}:`, error);
					errors.push(`${note.basename}: ${error}`);
				}

				// Small delay to allow UI to update
				if (i % 5 === 0) {
					await new Promise(resolve => setTimeout(resolve, 1));
				}
			}

			// Update button to show completion
			applyButton.textContent = 'Completed!';

			// Show results
			if (successCount > 0) {
				this.showSuccess(`Successfully applied contexts to ${successCount} notes.`);
			}

			if (errors.length > 0) {
				console.error('Batch update errors:', errors);
				this.showError(`Failed to update ${errors.length} notes. Check console for details.`);
			}

			// Close modal after showing results
			setTimeout(() => this.close(), 2000);
			
		} catch (error) {
			console.error('Error in batch save:', error);
			this.showError('Error applying contexts. Please try again.');
			
			// Reset button on error
			if (applyButton) {
				applyButton.textContent = 'Apply to All Notes';
				applyButton.disabled = false;
			}
		}
	}

	private async loadPastContextsAsync(): Promise<void> {
		try {
			// Load past contexts in the background
			const pastContexts = await this.noteService.getAllPastContexts();
			
			// Update the field manager with the loaded contexts
			if (this.contextFieldManager) {
				this.contextFieldManager.setPastContexts(pastContexts);
			}
		} catch (error) {
			console.error('Error loading past contexts for autocomplete:', error);
			// Fail silently - this is just quality of life, not critical functionality
		}
	}
}