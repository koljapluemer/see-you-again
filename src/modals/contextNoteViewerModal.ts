import { App, TFile, Notice, ButtonComponent } from 'obsidian';
import { NoteService } from '../noteService';
import { SeeYouAgainPlugin, ActionType } from '../types';
import { BaseNoteModal } from '../utils/baseModal';
import { ContextBrowserModal } from './contextBrowserModal';
import { ActionHandler, ActionHandlerContext } from '../actions/baseActionHandler';
import { ActionHandlerFactory } from '../actions/actionHandlerFactory';
import { ActionTypeScheduler } from '../scheduling/actionTypeScheduler';

export class ContextNoteViewerModal extends BaseNoteModal {
	private noteService: NoteService;
	private hydratedContext: string;
	private sanitizedContext: string;
	private currentActionType: ActionType | null = null;
	private currentActionHandler: ActionHandler | null = null;

	constructor(
		app: App, 
		plugin: SeeYouAgainPlugin,
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
		const resumeNotePath = this.plugin.stateManager.get('lastContextNote');
		if (resumeNotePath) {
			// Try to load the specific note
			const file = this.app.vault.getAbstractFileByPath(resumeNotePath);
			if (file instanceof TFile) {
				this.currentNote = file;
				
				// Get the action type from frontmatter for resume case
				const frontmatter = await this.noteService.getFrontmatter(file);
				this.currentActionType = frontmatter[this.sanitizedContext];
				
				if (this.currentActionType) {
					// Track the resumed action type
					this.plugin.stateManager.incrementActionTypeUsage(this.currentActionType);
					console.log(`[ContextNoteViewerModal] 🔄 Resumed note "${file.name}" with action type "${this.currentActionType}"`);
				}
				
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
			// Get the most underpicked action type based on current session usage
			const actionTypeUsage = this.plugin.stateManager.getActionTypeUsage();
			const preferredActionType = ActionTypeScheduler.getMostUnderpickedActionType(actionTypeUsage);
			
			console.log('[ContextNoteViewerModal] Loading note with scheduling info:', {
				context: this.sanitizedContext,
				preferredActionType,
				currentUsage: actionTypeUsage
			});
			
			// Log current usage summary
			console.log('[ContextNoteViewerModal] Current session usage:\n' + 
				ActionTypeScheduler.getUsageSummary(actionTypeUsage));

			// Try to get a note with the preferred action type
			const result = await this.noteService.getRandomNoteWithContextPrioritized(
				this.sanitizedContext, 
				preferredActionType
			);
			
			if (!result) {
				this.showNoNotesMessage();
				return;
			}

			this.currentNote = result.file;
			this.currentActionType = result.actionType;
			
			// Track that this action type was used
			this.plugin.stateManager.incrementActionTypeUsage(result.actionType);
			
			console.log(`[ContextNoteViewerModal] ✅ Selected note "${result.file.name}" with action type "${result.actionType}"`);

			await this.loadActionType();
			await this.renderModal();
		} catch (error) {
			console.error('Error loading random note with context:', error);
			this.showError('Error loading note. Please try again.');
		}
	}

	private async loadActionType(): Promise<void> {
		if (!this.currentNote || !this.currentActionType) {
			this.currentActionHandler = null;
			return;
		}

		try {
			// Clean up previous handler
			if (this.currentActionHandler && this.currentActionHandler.cleanup) {
				this.currentActionHandler.cleanup();
			}
			
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
				createButton: (container: HTMLElement, text: string, onClick: () => void | Promise<void>) => {
					const button = new ButtonComponent(container);
					button.setButtonText(text);
					button.onClick(onClick);
					return button.buttonEl;
				},
				showError: (message: string) => this.showError(message)
			};

			// Create the appropriate action handler
			this.currentActionHandler = await ActionHandlerFactory.createHandler(this.currentActionType, context);
		} catch (error) {
			console.error('Error loading action type:', error);
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
		this.plugin.stateManager.clearNavigationState();
		
		// Close this modal and open the context browser
		this.close();
		const contextBrowserModal = new ContextBrowserModal(this.app, this.plugin);
		contextBrowserModal.open();
	}

	private async jumpToNote(): Promise<void> {
		if (!this.currentNote) return;

		try {
			// Store transient state in state manager
			this.plugin.stateManager.update({
				lastContextNote: this.currentNote.path,
				lastContext: this.sanitizedContext
			});

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
