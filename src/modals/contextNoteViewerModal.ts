import { App, TFile, Notice, Plugin } from 'obsidian';
import { NoteService } from '../noteService';
import { SeeYouAgainSettings } from '../types';
import { BaseNoteModal } from '../utils/baseModal';
import { NoteRenderer } from '../utils/noteRenderer';

export class ContextNoteViewerModal extends BaseNoteModal {
	private noteService: NoteService;
	private hydratedContext: string;
	private sanitizedContext: string;

	constructor(
		app: App, 
		plugin: Plugin & { settings: SeeYouAgainSettings; saveSettings(): Promise<void> },
		hydratedContext: string,
		sanitizedContext: string
	) {
		super(app, plugin);
		this.noteService = new NoteService(app);
		this.hydratedContext = hydratedContext;
		this.sanitizedContext = sanitizedContext;
	}

	async onOpen(): Promise<void> {
		await this.loadRandomNote();
	}

	onClose(): void {
		super.onClose();
	}

	private async loadRandomNote(): Promise<void> {
		try {
			this.currentNote = await this.noteService.getRandomNoteWithContext(this.sanitizedContext);
			
			if (!this.currentNote) {
				this.showNoNotesMessage();
				return;
			}

			await this.renderModal();
		} catch (error) {
			console.error('Error loading random note with context:', error);
			this.showError('Error loading note. Please try again.');
		}
	}

	private showNoNotesMessage(): void {
		const { contentEl } = this;
		contentEl.empty();
		
		const header = contentEl.createEl('div');
		header.className = 'context-note-viewer-no-notes';
		
		header.createEl('h2', { text: 'No Notes Found' });
		header.createEl('p', { 
			text: `No notes found with the context "${this.hydratedContext}".` 
		});
		
		const closeButton = header.createEl('button', { text: 'Close' });
		closeButton.className = 'modal-close-button';
		closeButton.addEventListener('click', () => this.close());
	}

	private async renderModal(): Promise<void> {
		if (!this.currentNote) return;

		const { contentEl } = this;
		contentEl.empty();

		// Header with context label and jump button
		const header = this.createHeader(this.currentNote.basename, 'Jump to Note', () => this.jumpToNote());
		
		// Add context label above title
		const contextLabel = document.createElement('div');
		contextLabel.textContent = `Context: ${this.hydratedContext}`;
		contextLabel.className = 'context-note-viewer-label';
		header.insertBefore(contextLabel, header.firstChild);

		// Note preview
		const previewContainer = contentEl.createEl('div');
		previewContainer.className = 'context-note-viewer-preview';
		
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

		// Next button
		const buttonContainer = contentEl.createEl('div');
		buttonContainer.className = 'context-note-viewer-button-container';
		
		const nextButton = buttonContainer.createEl('button', { text: 'Next' });
		nextButton.className = 'context-note-viewer-next-button';
		
		nextButton.addEventListener('click', () => this.handleNext());
	}

	private async handleNext(): Promise<void> {
		await this.loadRandomNote();
	}
}
