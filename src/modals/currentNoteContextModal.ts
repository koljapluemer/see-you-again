import type { App} from 'obsidian';
import { Notice, MarkdownView, ButtonComponent } from 'obsidian';

import { NoteService } from '../noteService';
import type { SeeYouAgainPlugin, ActionType} from '../types';
import { ACTION_OPTIONS } from '../types';
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
		if (!this.currentNote) {return;}

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
		}
	}

	private async renderModal(): Promise<void> {
		if (!this.currentNote) {return;}

		const { contentEl } = this;
		contentEl.empty();

		// Create header with note filename
		this.createHeader(`Manage Contexts: ${this.currentNote.basename}`);

		// Context fields container
		const fieldsContainer = contentEl.createEl('div');
		fieldsContainer.className = 'modal-fields-container';

		this.contextFieldManager = new ContextFieldManager(
			this.app,
			fieldsContainer,
			() => { /* no-op */ }
		);

		// Load past contexts for autocomplete
		const pastContexts = await this.noteService.getAllPastContexts();
		this.contextFieldManager.setPastContexts(pastContexts);

		// Prefill with existing contexts
		this.prefillExistingContexts();

		// Buttons
		const buttonContainer = contentEl.createEl('div');
		buttonContainer.className = 'modal-button-row';

		// Save button
		const saveButton = new ButtonComponent(buttonContainer);
		saveButton.setButtonText('Save Contexts');
		saveButton.onClick(async () => {
			await this.saveAllContexts();
		});

		// Close button
		const closeButton = new ButtonComponent(buttonContainer);
		closeButton.setButtonText('Close');
		closeButton.onClick(() => this.close());
	}

	private prefillExistingContexts(): void {
		if (!this.contextFieldManager) {return;}

		// Convert existing contexts to ContextEntry format and prefill
		Object.entries(this.existingContexts).forEach(([sanitizedContext, action]) => {
			const hydratedContext = ContextUtils.hydrateContextKey(sanitizedContext);
			this.contextFieldManager!.addEntry(hydratedContext, action);
		});
	}

	private async saveAllContexts(): Promise<void> {
		if (!this.currentNote || !this.contextFieldManager) {return;}

		const allEntries = this.contextFieldManager.getEntries();
		if (allEntries.length === 0) {
			new Notice('No contexts to save');
			return;
		}

		try {
			const newContexts: { [key: string]: ActionType } = {};

			for (const entry of allEntries) {
				if (!ContextUtils.validateContext(entry.context)) {
					new Notice(`Context "${entry.context}" is too long or invalid`);
					continue;
				}

				const sanitizedKey = ContextUtils.sanitizeContextKey(entry.context);
				newContexts[sanitizedKey] = entry.action;
			}

			await this.noteService.saveMetadata(this.currentNote, newContexts);
			new Notice(`Saved ${Object.keys(newContexts).length} contexts`);
			this.close();
		} catch (error) {
			this.showError('Error saving contexts. Please try again.');
		}
	}


}