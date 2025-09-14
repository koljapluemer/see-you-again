import { App, Notice, MarkdownView, ButtonComponent } from 'obsidian';
import { NoteService } from '../noteService';
import { SeeYouAgainPlugin, ActionType, ACTION_OPTIONS } from '../types';
import { BaseNoteModal } from '../utils/baseModal';
import { ContextFieldManager } from '../components/modalComponents';
import { ContextUtils } from '../utils/contextUtils';

export class CurrentNoteContextModal extends BaseNoteModal {
	private noteService: NoteService;
	private contextFieldManager: ContextFieldManager | null = null;
	private existingContexts: { [key: string]: ActionType } = {};

	constructor(app: App, plugin: SeeYouAgainPlugin) {
		super(app, plugin);
		this.noteService = new NoteService(app);
	}

	async onOpen(): Promise<void> {
		super.onOpen();
		
		// Get the currently active note
		const activeLeaf = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeLeaf || !activeLeaf.file) {
			new Notice('No active note found');
			this.close();
			return;
		}

		this.currentNote = activeLeaf.file;
		await this.loadExistingContexts();
		await this.renderModal();
	}

	onClose(): void {
		// Clean up the context field manager
		if (this.contextFieldManager) {
			this.contextFieldManager.destroy();
			this.contextFieldManager = null;
		}
		super.onClose();
	}

	private async loadExistingContexts(): Promise<void> {
		if (!this.currentNote) return;

		try {
			const fileCache = this.app.metadataCache.getFileCache(this.currentNote);
			const frontmatter = fileCache?.frontmatter;
			
			if (frontmatter && frontmatter['see-you-again']) {
				const seeYouAgain = frontmatter['see-you-again'];
				if (typeof seeYouAgain === 'object' && !Array.isArray(seeYouAgain)) {
					this.existingContexts = { ...seeYouAgain };
				}
			}
		} catch (error) {
			console.error('Error loading contexts:', error);
		}
	}

	private async renderModal(): Promise<void> {
		if (!this.currentNote) return;

		const { contentEl } = this;
		contentEl.empty();

		// Create header using the base modal method
		this.createHeader('Manage Contexts');
		
		// Show current note name
		const noteInfo = contentEl.createEl('div');
		noteInfo.className = 'current-note-title';
		noteInfo.createEl('strong', { text: 'Note: ' });
		noteInfo.createSpan({ text: this.currentNote.basename });

		// Show existing contexts if any
		if (Object.keys(this.existingContexts).length > 0) {
			const existingSection = contentEl.createEl('div');
			existingSection.className = 'existing-contexts-container';
			existingSection.createEl('h3', { text: 'Current Contexts:' });
			
			const pillsContainer = existingSection.createEl('div');
			pillsContainer.className = 'context-pills-container';
			
			this.renderExistingContexts(pillsContainer);
		}

		// Add new contexts section
		const addSection = contentEl.createEl('div');
		addSection.className = 'add-context-section';
		addSection.createEl('h3', { text: 'Add New Contexts:' });

		// Use the existing ContextFieldManager for adding contexts
		const fieldsContainer = addSection.createEl('div');
		fieldsContainer.className = 'modal-fields-container';

		this.contextFieldManager = new ContextFieldManager(
			this.app,
			fieldsContainer,
			() => { /* no-op */ }
		);

		// Load past contexts for autocomplete
		const pastContexts = await this.noteService.getAllPastContexts();
		this.contextFieldManager.setPastContexts(pastContexts);

		// Buttons
		const buttonContainer = contentEl.createEl('div');
		buttonContainer.className = 'modal-button-row';

		// Save button
		const saveButton = new ButtonComponent(buttonContainer);
		saveButton.setButtonText('Save Contexts');
		saveButton.onClick(async () => {
			await this.saveNewContexts();
		});

		// Close button
		const closeButton = new ButtonComponent(buttonContainer);
		closeButton.setButtonText('Close');
		closeButton.onClick(() => this.close());
	}

	private renderExistingContexts(container: HTMLElement): void {
		Object.entries(this.existingContexts).forEach(([sanitizedContext, action]) => {
			const hydratedContext = ContextUtils.hydrateContextKey(sanitizedContext);
			const actionLabel = ACTION_OPTIONS.find(opt => opt.value === action)?.label || action;

			const pill = container.createEl('div');
			pill.className = 'context-pill';

			const contextText = pill.createEl('span', { text: hydratedContext });
			contextText.className = 'context-text';

			const actionBadge = pill.createEl('span', { text: actionLabel });
			actionBadge.className = 'action-badge';

			const removeButton = pill.createEl('button', { text: '×' });
			removeButton.className = 'remove-button';
			removeButton.addEventListener('click', async () => {
				await this.removeContext(sanitizedContext);
			});
		});
	}

	private async removeContext(sanitizedContext: string): Promise<void> {
		if (!this.currentNote) return;

		try {
			delete this.existingContexts[sanitizedContext];
			await this.saveContexts();
			
			const hydratedContext = ContextUtils.hydrateContextKey(sanitizedContext);
			new Notice(`Removed context: ${hydratedContext}`);
			
			// Re-render the modal
			await this.renderModal();
		} catch (error) {
			console.error('Error removing context:', error);
			this.showError('Error removing context. Please try again.');
		}
	}

	private async saveNewContexts(): Promise<void> {
		if (!this.currentNote || !this.contextFieldManager) return;

		const newEntries = this.contextFieldManager.getEntries();
		if (newEntries.length === 0) {
			new Notice('No new contexts to add');
			return;
		}

		try {
			let addedCount = 0;
			
			for (const entry of newEntries) {
				if (!ContextUtils.validateContext(entry.context)) {
					new Notice(`Context "${entry.context}" is too long or invalid`);
					continue;
				}

				const sanitizedKey = ContextUtils.sanitizeContextKey(entry.context);
				
				// Check if context already exists
				if (this.existingContexts[sanitizedKey]) {
					new Notice(`Context "${entry.context}" already exists for this note`);
					continue;
				}

				this.existingContexts[sanitizedKey] = entry.action;
				addedCount++;
			}

			if (addedCount > 0) {
				await this.saveContexts();
				new Notice(`Added ${addedCount} context${addedCount !== 1 ? 's' : ''}`);
				
				// Reset the field manager and re-render
				this.contextFieldManager.reset();
				await this.renderModal();
			}
		} catch (error) {
			console.error('Error saving contexts:', error);
			this.showError('Error saving contexts. Please try again.');
		}
	}

	private async saveContexts(): Promise<void> {
		if (!this.currentNote) return;
		await this.noteService.saveMetadata(this.currentNote, this.existingContexts);
	}

}