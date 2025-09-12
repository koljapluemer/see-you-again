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
			const searchView = this.app.workspace.getLeavesOfType('search')[0]?.view as SearchView;
			
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
		buttonContainer.className = 'modal-no-notes-button-container';
		
		const closeButton = buttonContainer.createEl('button', { text: 'Close' });
		closeButton.className = 'modal-close-button';
		closeButton.addEventListener('click', () => this.close());
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
		this.contextFieldManager = new ContextFieldManager(fieldsContainer, (entries) => {
			this.updateButtonStates();
		});

		// Load past contexts asynchronously
		this.loadPastContextsAsync();

		// Buttons container
		const buttonsContainer = contentEl.createEl('div');
		buttonsContainer.className = 'modal-button-container';

		const leftButtons = buttonsContainer.createEl('div');
		const rightButtons = buttonsContainer.createEl('div');

		// Left side button (Cancel)
		const cancelButton = this.createStyledButton('Cancel', () => this.close());
		leftButtons.appendChild(cancelButton);

		// Right side button (Apply to All)
		const applyButton = this.createStyledButton('Apply to All Notes', () => this.handleBatchSave(), 'primary');
		applyButton.id = 'batch-apply-button';
		rightButtons.appendChild(applyButton);

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

		try {
			// Prepare metadata object
			const metadata: SeeYouAgainFrontmatter = {};
			entries.forEach(entry => {
				const sanitizedKey = ContextUtils.sanitizeContextKey(entry.context);
				metadata[sanitizedKey] = entry.action;
			});

			let successCount = 0;
			let skipCount = 0;
			const errors: string[] = [];

			// Apply contexts to all notes in search results
			for (const note of this.searchResults) {
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
			}

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