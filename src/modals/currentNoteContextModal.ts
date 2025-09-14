import type { App} from 'obsidian';
import { Notice, MarkdownView, ButtonComponent } from 'obsidian';

import { NoteService } from '../noteService';
import type { SeeYouAgainPlugin, ActionType} from '../types';
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

	onOpen(): void {
		super.onOpen();
		
		// Get the currently active note
		const activeLeaf = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeLeaf || !activeLeaf.file) {
			new Notice('No active note found');
			this.close();
			return;
		}

		this.currentNote = activeLeaf.file;
		this.loadExistingContexts();
		this.renderModal();
	}

	onClose(): void {
		// Clean up the context field manager
		if (this.contextFieldManager) {
			this.contextFieldManager.destroy();
			this.contextFieldManager = null;
		}
		super.onClose();
	}

	private loadExistingContexts(): void {
		if (!this.currentNote) {return;}

		try {
			const fileCache = this.app.metadataCache.getFileCache(this.currentNote);
			const frontmatter = fileCache?.frontmatter;
			
			if (frontmatter && typeof frontmatter === 'object' && 'see-you-again' in frontmatter) {
				const seeYouAgain: unknown = frontmatter['see-you-again'];
				if (typeof seeYouAgain === 'object' && seeYouAgain !== null && !Array.isArray(seeYouAgain)) {
					this.existingContexts = { ...seeYouAgain as Record<string, ActionType> };
				}
			}
		} catch (error) {
			// Handle error loading existing contexts
		}
	}

	private renderModal(): void {
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
		const pastContexts = this.noteService.getAllPastContexts();
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

		// Convert existing contexts to ContextEntry format
		const existingEntries = Object.entries(this.existingContexts).map(([sanitizedContext, action]) => {
			const hydratedContext = ContextUtils.hydrateContextKey(sanitizedContext);
			return { context: hydratedContext, action };
		});

		// If we have existing entries, we need to work around the private API
		if (existingEntries.length > 0) {
			// Reset to clear default entries
			this.contextFieldManager.reset();
			
			// Type-safe workaround: Add a public method to ContextFieldManager instead
			// For now, we'll add entries manually by simulating user input
			existingEntries.forEach((entry, index) => {
				// This is a temporary solution - ideally ContextFieldManager should have a setEntries method
				if (index === 0) {
					// Replace first default entry
					(this.contextFieldManager as unknown as { entries: Array<{ context: string; action: string }> }).entries[0] = entry;
				} else {
					// Add additional entries
					(this.contextFieldManager as unknown as { entries: Array<{ context: string; action: string }> }).entries.push(entry);
				}
			});
			
			// Re-render to show the entries
			(this.contextFieldManager as unknown as { render(): void }).render();
		}
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