import { App, TFile, Notice, Plugin } from 'obsidian';
import { NoteService } from '../noteService';
import { SeeYouAgainSettings, ActionType } from '../types';
import { BaseNoteModal } from '../utils/baseModal';
import { ContextBrowserModal } from './contextBrowserModal';
import { ActionHandler, ActionHandlerContext } from '../actions/baseActionHandler';
import { ActionHandlerFactory } from '../actions/actionHandlerFactory';

export class ContextNoteViewerModal extends BaseNoteModal {
	private noteService: NoteService;
	private hydratedContext: string;
	private sanitizedContext: string;
	private currentActionType: ActionType | null = null;
	private currentActionHandler: ActionHandler | null = null;

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
				await this.loadActionType();
				await this.renderModal();
				return;
			}
		}
		
		// Otherwise load a random note
		await this.loadRandomNote();
	}

	onClose(): void {
		// Clean up the current action handler
		if (this.currentActionHandler && this.currentActionHandler.cleanup) {
			this.currentActionHandler.cleanup();
		}
		super.onClose();
	}

	private async loadRandomNote(): Promise<void> {
		try {
			this.currentNote = await this.noteService.getRandomNoteWithContext(this.sanitizedContext);
			
			if (!this.currentNote) {
				this.showNoNotesMessage();
				return;
			}

			await this.loadActionType();
			await this.renderModal();
		} catch (error) {
			console.error('Error loading random note with context:', error);
			this.showError('Error loading note. Please try again.');
		}
	}

	private async loadActionType(): Promise<void> {
		if (!this.currentNote) {
			this.currentActionType = null;
			this.currentActionHandler = null;
			return;
		}

		try {
			// Clean up previous handler
			if (this.currentActionHandler && this.currentActionHandler.cleanup) {
				this.currentActionHandler.cleanup();
			}

			const frontmatter = await this.noteService.getFrontmatter(this.currentNote);
			this.currentActionType = frontmatter[this.sanitizedContext] || null;
			
			// Create action handler context
			const context: ActionHandlerContext = {
				app: this.app,
				plugin: this.plugin,
				currentNote: this.currentNote,
				hydratedContext: this.hydratedContext,
				sanitizedContext: this.sanitizedContext,
				onNext: () => this.handleNext(),
				onChangeContext: () => this.changeContext(),
				onJumpToNote: () => this.jumpToNote(),
				createStyledButton: (text: string, onClick: () => void | Promise<void>) => this.createStyledButton(text, onClick),
				showError: (message: string) => this.showError(message)
			};

			// Create the appropriate action handler
			this.currentActionHandler = await ActionHandlerFactory.createHandler(this.currentActionType, context);
		} catch (error) {
			console.error('Error loading action type:', error);
			this.currentActionType = null;
			this.currentActionHandler = null;
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
		if (!this.currentNote || !this.currentActionHandler) return;

		const { contentEl } = this;
		contentEl.empty();

		// Action-specific prompt at the very top
		const promptText = this.currentActionHandler.getPromptText();
		const promptLabel = contentEl.createEl('div');
		promptLabel.textContent = promptText;
		promptLabel.className = 'action-prompt';
		promptLabel.style.fontWeight = 'bold';
		promptLabel.style.color = 'var(--text-accent)';
		promptLabel.style.fontSize = '1.1em';
		promptLabel.style.marginBottom = '16px';
		promptLabel.style.textAlign = 'center';

		// Header with just the note title
		const header = this.createHeader(this.currentNote.basename);

		// Note content (handled by action handler)
		const previewContainer = contentEl.createEl('div');
		previewContainer.className = 'context-note-viewer-preview';
		
		await this.currentActionHandler.renderNoteContent(previewContainer);

		// Buttons (handled by action handler)
		const buttonContainer = contentEl.createEl('div');
		buttonContainer.className = 'modal-button-row';
		
		this.currentActionHandler.createButtons(buttonContainer);
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
