import type { App } from 'obsidian';
import { TFile, ButtonComponent } from 'obsidian';

import { NoteService } from '../noteService';
import type { SeeYouAgainPlugin, ActionType } from '../types';
import { BaseNoteModal } from '../utils/baseModal';
import { ContextBrowserModal } from './contextBrowserModal';
import type { ActionHandler, ActionHandlerContext } from '../actions/baseActionHandler';
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
		if (resumeNotePath !== null && resumeNotePath !== undefined && resumeNotePath !== '') {
			// Try to load the specific note
			const file = this.app.vault.getAbstractFileByPath(resumeNotePath);
			if (file instanceof TFile) {
				this.currentNote = file;

				// Get the action type from frontmatter for resume case
				const frontmatter = this.noteService.getFrontmatter(file);
				this.currentActionType = frontmatter[this.sanitizedContext];

				if (this.currentActionType) {
					// Track the resumed action type
					this.plugin.stateManager.incrementActionTypeUsage(this.currentActionType);
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

			// Action type scheduling with preferred type selection

			// Try to get a note with the preferred action type
			const result = this.noteService.getRandomNoteWithContextPrioritized(
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


			await this.loadActionType();
			await this.renderModal();
		} catch (error) {
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
				onRemoveContext: () => this.removeContext(),
				onRemoveContextAndArchive: () => this.removeContextAndArchive(),
				onDeleteNote: () => this.deleteNote(),
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
		if (!this.currentNote || !this.currentActionHandler) { return; }

		const { contentEl } = this;
		contentEl.empty();

		// Mark the note as seen when displayed
		try {
			await this.noteService.markNoteSeen(this.currentNote);
		} catch (error) {
			console.error('Failed to mark note as seen:', error);
			// Continue rendering even if marking as seen fails
		}

		// Action-specific prompt
		const promptText = this.currentActionHandler.getPromptText();
		const promptLabel = contentEl.createEl('div');
		promptLabel.textContent = promptText;
		promptLabel.className = 'action-prompt';
		promptLabel.style.fontWeight = 'bold';
		promptLabel.style.color = 'var(--text-accent)';
		promptLabel.style.fontSize = '1.1em';
		promptLabel.style.marginBottom = '16px';
		promptLabel.style.textAlign = 'center';

		// Note title (only for non-memorize actions, memorize handles its own heading)
		if (this.currentActionType !== 'memorize') {
			this.createHeader(this.currentNote.basename);
		}

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
		if (!this.currentNote) { return; }

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
			this.showError('Error opening note. Please try again.');
		}
	}

	private async removeContext(): Promise<void> {
		if (!this.currentNote) { return; }

		try {
			await this.noteService.removeContext(this.currentNote, this.sanitizedContext);
			await this.handleNext(); // Load next note after removing context
		} catch (error) {
			this.showError('Error removing context. Please try again.');
		}
	}

	private async removeContextAndArchive(): Promise<void> {
		if (!this.currentNote) { return; }

		try {
			await this.noteService.removeContext(this.currentNote, this.sanitizedContext);
			await this.noteService.archiveNote(this.currentNote, this.plugin.settings.archiveFolder);
			await this.handleNext(); // Load next note after archiving
		} catch (error) {
			this.showError('Error archiving note. Please try again.');
		}
	}

	private async deleteNote(): Promise<void> {
		if (!this.currentNote) { return; }

		// Confirm deletion
		const confirmed = confirm(`Are you sure you want to delete the note "${this.currentNote.basename}"? This cannot be undone.`);
		if (!confirmed) { return; }

		try {
			await this.noteService.deleteNote(this.currentNote);
			await this.handleNext(); // Load next note after deletion
		} catch (error) {
			this.showError('Error deleting note. Please try again.');
		}
	}
}
