import { App, TFile, Notice, Plugin } from 'obsidian';
import { NoteService } from '../noteService';
import { ContextFieldManager, ModalButtonManager } from '../components/modalComponents';
import { ContextEntry, SeeYouAgainFrontmatter, SeeYouAgainSettings } from '../types';
import { BaseNoteModal } from '../utils/baseModal';
import { NoteRenderer } from '../utils/noteRenderer';
import { ContextUtils } from '../utils/contextUtils';

export class AddContextModal extends BaseNoteModal {
	private noteService: NoteService;
	private contextFieldManager: ContextFieldManager | null = null;
	private buttonManager: ModalButtonManager | null = null;

	constructor(app: App, plugin: Plugin & { settings: SeeYouAgainSettings; saveSettings(): Promise<void> }) {
		super(app, plugin);
		this.noteService = new NoteService(app);
	}

	async onOpen(): Promise<void> {
		await this.loadRandomNote();
	}

	onClose(): void {
		// Clean up autocomplete instances
		this.contextFieldManager?.destroy();
		this.contextFieldManager = null;
		this.buttonManager = null;
		
		super.onClose();
	}

	private async loadRandomNote(): Promise<void> {
		try {
			// First, try to load the previously opened note if it exists and is still eligible
			if (this.plugin.settings.currentModalNote) {
				const previousNote = this.app.vault.getAbstractFileByPath(this.plugin.settings.currentModalNote);
				if (previousNote instanceof TFile) {
					const isStillEligible = await this.noteService.isNoteEligible(previousNote);
					if (isStillEligible) {
						this.currentNote = previousNote;
						await this.renderModal();
						return;
					} else {
						// Note is no longer eligible, clear it from settings
						this.plugin.settings.currentModalNote = '';
						await this.plugin.saveSettings();
					}
				} else {
					// Note no longer exists, clear it from settings
					this.plugin.settings.currentModalNote = '';
					await this.plugin.saveSettings();
				}
			}

			// If no previous note or it's not eligible, get a random one
			this.currentNote = await this.noteService.getRandomNote();
			
			if (!this.currentNote) {
				this.showNoNotesMessage();
				return;
			}

			// Save the new current note
			this.plugin.settings.currentModalNote = this.currentNote.path;
			await this.plugin.saveSettings();

			await this.renderModal();
		} catch (error) {
			console.error('Error loading random note:', error);
			this.showError('Error loading note. Please try again.');
		}
	}

	private showNoNotesMessage(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: 'No Notes Available' });
		contentEl.createEl('p', { 
			text: 'All notes in your vault already have "see-you-again" metadata, or there are no notes available.' 
		});
		
		const buttonContainer = contentEl.createEl('div');
		buttonContainer.style.cssText = 'margin-top: 20px; text-align: center;';
		
		const closeButton = buttonContainer.createEl('button', { text: 'Close' });
		closeButton.style.cssText = 'padding: 8px 16px; border: 1px solid var(--background-modifier-border); border-radius: 4px; background: var(--background-secondary); cursor: pointer;';
		closeButton.addEventListener('click', () => this.close());
	}

	private async renderModal(): Promise<void> {
		if (!this.currentNote) return;

		const { contentEl } = this;
		contentEl.empty();

		// Header with title and jump button
		this.createHeader(this.currentNote.basename, 'Jump to Note', () => this.jumpToNote());

		// Note preview
		const previewContainer = contentEl.createEl('div');
		previewContainer.style.cssText = 'margin-bottom: 20px; padding: 12px; background: var(--background-secondary); border-radius: 6px; max-height: 300px; overflow-y: auto; border: 1px solid var(--background-modifier-border);';
		
		try {
			const noteContent = await this.app.vault.read(this.currentNote);
			if (!noteContent || noteContent.trim().length === 0) {
				previewContainer.createEl('div', { 
					text: 'This note is empty',
					cls: 'note-preview-empty'
				});
				previewContainer.style.fontStyle = 'italic';
				previewContainer.style.color = 'var(--text-muted)';
			} else {
				// Render the markdown content
				await NoteRenderer.renderNoteContent(previewContainer, noteContent, this.currentNote, this.app, this.plugin);
			}
		} catch (error) {
			console.error('Error loading note content:', error);
			previewContainer.createEl('div', { 
				text: 'Could not load note preview',
				cls: 'note-preview-error'
			});
			previewContainer.style.color = 'var(--text-error)';
		}

		// Context fields container
		const fieldsContainer = contentEl.createEl('div');
		fieldsContainer.style.cssText = 'margin-bottom: 20px;';

		// Initialize field manager
		this.contextFieldManager = new ContextFieldManager(fieldsContainer, (entries) => {
			this.buttonManager?.updateButtonStates();
		});

		// Load past contexts asynchronously (quality of life, don't wait)
		this.loadPastContextsAsync();

		// Buttons container
		const buttonsContainer = contentEl.createEl('div');
		
		// Initialize button manager
		this.buttonManager = new ModalButtonManager(buttonsContainer, {
			onSkip: () => this.handleSkip(),
			onExclude: () => this.handleExclude(),
			onNext: () => this.handleSaveAndNext(),
			isValidForm: () => this.contextFieldManager?.hasValidEntries() || false
		});
	}

	private async handleSkip(): Promise<void> {
		// Clear the current note from settings so we get a new random one
		this.plugin.settings.currentModalNote = '';
		await this.plugin.saveSettings();
		await this.loadRandomNote();
	}

	private async handleExclude(): Promise<void> {
		if (!this.currentNote) return;

		try {
			await this.noteService.excludeNote(this.currentNote);
			new Notice(`Excluded "${this.currentNote.basename}" from future sessions`);
			
			// Clear the current note from settings and load a new one
			this.plugin.settings.currentModalNote = '';
			await this.plugin.saveSettings();
			await this.loadRandomNote();
		} catch (error) {
			console.error('Error excluding note:', error);
			this.showError('Error excluding note. Please try again.');
		}
	}

	private async handleSave(): Promise<void> {
		if (!this.currentNote || !this.contextFieldManager) return;

		const entries = this.contextFieldManager.getEntries();
		if (entries.length === 0) {
			this.showError('Please add at least one context before saving.');
			return;
		}

		try {
			const metadata: SeeYouAgainFrontmatter = {};
			entries.forEach(entry => {
				const sanitizedKey = ContextUtils.sanitizeContextKey(entry.context);
				metadata[sanitizedKey] = entry.action;
			});

			await this.noteService.saveMetadata(this.currentNote, metadata);
			this.showSuccess(`Saved contexts for "${this.currentNote.basename}"`);
			
			// Clear the current note from settings and load a new one
			this.plugin.settings.currentModalNote = '';
			await this.plugin.saveSettings();
			await this.loadRandomNote();
		} catch (error) {
			console.error('Error saving note metadata:', error);
			this.showError('Error saving note. Please try again.');
		}
	}

	private async handleSaveAndNext(): Promise<void> {
		await this.handleSave();
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
