import { App, TFile, Notice, Plugin } from 'obsidian';
import { NoteService } from '../noteService';
import { SeeYouAgainSettings } from '../types';
import { BaseNoteModal } from '../utils/baseModal';
import { NoteRenderer } from '../utils/noteRenderer';
import { ContextBrowserModal } from './contextBrowserModal';

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
		// Check if we should resume from a specific note
		const resumeNotePath = (this as any).resumeFromNotePath;
		if (resumeNotePath) {
			// Try to load the specific note
			const file = this.app.vault.getAbstractFileByPath(resumeNotePath);
			if (file instanceof TFile) {
				this.currentNote = file;
				await this.renderModal();
				return;
			}
		}
		
		// Otherwise load a random note
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
		
		// Button row
		const buttonContainer = contentEl.createEl('div');
		buttonContainer.className = 'modal-button-row';
		
		const closeButton = this.createStyledButton('Close', () => this.close());
		buttonContainer.appendChild(closeButton);
	}

	private async renderModal(): Promise<void> {
		if (!this.currentNote) return;

		const { contentEl } = this;
		contentEl.empty();

		// Header with context label only
		const header = this.createHeader(this.currentNote.basename);
		
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

		// Button row with Change Context, Jump to Note, Next buttons
		const buttonContainer = contentEl.createEl('div');
		buttonContainer.className = 'modal-button-row';
		
		const changeContextButton = this.createStyledButton('Change Context', () => this.changeContext());
		const jumpButton = this.createStyledButton('Jump to Note', () => this.jumpToNote());
		const nextButton = this.createStyledButton('Next', () => this.handleNext());
		
		buttonContainer.appendChild(changeContextButton);
		buttonContainer.appendChild(jumpButton);
		buttonContainer.appendChild(nextButton);
	}

	private async handleNext(): Promise<void> {
		await this.loadRandomNote();
	}

	private changeContext(): void {
		// Clear stored state since user wants to change context
		(this.plugin as any).lastContextNote = null;
		(this.plugin as any).lastContext = null;
		
		// Close this modal and open the context browser
		this.close();
		const contextBrowserModal = new ContextBrowserModal(this.app, this.plugin);
		contextBrowserModal.open();
	}

	private async jumpToNote(): Promise<void> {
		if (!this.currentNote) return;

		try {
			// Store transient state in plugin instance (not persistent settings)
			(this.plugin as any).lastContextNote = this.currentNote.path;
			(this.plugin as any).lastContext = this.sanitizedContext;

			// Open the note in the active leaf (same tab)  
			const leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(this.currentNote);
			
			// Focus the leaf
			this.app.workspace.setActiveLeaf(leaf);
			
			// Close the modal
			this.close();
		} catch (error) {
			console.error('Error jumping to note:', error);
			this.showError('Error opening note. Please try again.');
		}
	}
}
