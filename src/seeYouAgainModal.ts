import { App, Modal, TFile, Notice, Plugin } from 'obsidian';
import { NoteService } from './noteService';
import { ContextFieldManager, ModalButtonManager } from './modalComponents';
import { ContextEntry, SeeYouAgainFrontmatter, SeeYouAgainSettings } from './types';

export class SeeYouAgainModal extends Modal {
	private plugin: Plugin & { settings: SeeYouAgainSettings; saveSettings(): Promise<void> };
	private noteService: NoteService;
	private currentNote: TFile | null = null;
	private contextFieldManager: ContextFieldManager | null = null;
	private buttonManager: ModalButtonManager | null = null;

	constructor(app: App, plugin: Plugin & { settings: SeeYouAgainSettings; saveSettings(): Promise<void> }) {
		super(app);
		this.plugin = plugin;
		this.noteService = new NoteService(app);
	}

	async onOpen(): Promise<void> {
		await this.loadRandomNote();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.currentNote = null;
		this.contextFieldManager = null;
		this.buttonManager = null;
	}

	private async loadRandomNote(): Promise<void> {
		try {
			this.currentNote = await this.noteService.getRandomNote();
			
			if (!this.currentNote) {
				this.showNoNotesMessage();
				return;
			}

			await this.renderModal();
		} catch (error) {
			console.error('Error loading random note:', error);
			new Notice('Error loading note. Please try again.');
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

		// Header
		const header = contentEl.createEl('div');
		header.style.cssText = 'margin-bottom: 20px; border-bottom: 1px solid var(--background-modifier-border); padding-bottom: 15px;';
		
		const title = header.createEl('h2', { text: 'See You Again' });
		title.style.cssText = 'margin: 0 0 8px 0; color: var(--text-normal);';
		
		const noteTitle = header.createEl('h3', { text: this.currentNote.basename });
		noteTitle.style.cssText = 'margin: 0; color: var(--text-accent); font-weight: normal;';

		// Note preview
		const previewContainer = contentEl.createEl('div');
		previewContainer.style.cssText = 'margin-bottom: 20px; padding: 12px; background: var(--background-secondary); border-radius: 6px; max-height: 200px; overflow-y: auto;';
		
		try {
			const noteContent = await this.app.vault.read(this.currentNote);
			const preview = noteContent.length > 300 ? noteContent.substring(0, 300) + '...' : noteContent;
			previewContainer.createEl('div', { text: preview || 'Empty note' });
		} catch (error) {
			previewContainer.createEl('div', { text: 'Could not load note preview' });
		}

		// Instructions
		const instructionsContainer = contentEl.createEl('div');
		instructionsContainer.style.cssText = 'margin-bottom: 20px;';
		instructionsContainer.createEl('p', { 
			text: 'Add usage contexts for this note. As you type in the last field, a new one will appear.' 
		});

		// Context fields container
		const fieldsContainer = contentEl.createEl('div');
		fieldsContainer.style.cssText = 'margin-bottom: 20px;';

		// Initialize field manager
		this.contextFieldManager = new ContextFieldManager(fieldsContainer, (entries) => {
			this.buttonManager?.updateButtonStates();
		});

		// Buttons container
		const buttonsContainer = contentEl.createEl('div');
		
		// Initialize button manager
		this.buttonManager = new ModalButtonManager(buttonsContainer, {
			onSkip: () => this.handleSkip(),
			onExclude: () => this.handleExclude(),
			onSave: () => this.handleSave(),
			onNext: () => this.handleNext(),
			isValidForm: () => this.contextFieldManager?.hasValidEntries() || false
		});
	}

	private async handleSkip(): Promise<void> {
		await this.loadRandomNote();
	}

	private async handleExclude(): Promise<void> {
		if (!this.currentNote) return;

		try {
			await this.noteService.excludeNote(this.currentNote);
			new Notice(`Excluded "${this.currentNote.basename}" from future sessions`);
			await this.loadRandomNote();
		} catch (error) {
			console.error('Error excluding note:', error);
			new Notice('Error excluding note. Please try again.');
		}
	}

	private async handleSave(): Promise<void> {
		if (!this.currentNote || !this.contextFieldManager) return;

		const entries = this.contextFieldManager.getEntries();
		if (entries.length === 0) {
			new Notice('Please add at least one context before saving.');
			return;
		}

		try {
			const metadata: SeeYouAgainFrontmatter = {};
			entries.forEach(entry => {
				metadata[entry.context] = entry.action;
			});

			await this.noteService.saveMetadata(this.currentNote, metadata);
			new Notice(`Saved contexts for "${this.currentNote.basename}"`);
			await this.loadRandomNote();
		} catch (error) {
			console.error('Error saving note metadata:', error);
			new Notice('Error saving note. Please try again.');
		}
	}

	private async handleNext(): Promise<void> {
		await this.handleSave();
	}
}
