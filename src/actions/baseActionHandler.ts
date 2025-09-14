import type { App, TFile } from 'obsidian';

import type { SeeYouAgainPlugin } from '../types';

export interface ActionHandlerContext {
	app: App;
	plugin: SeeYouAgainPlugin;
	currentNote: TFile;
	hydratedContext: string;
	sanitizedContext: string;
	onNext: () => Promise<void>;
	onChangeContext: () => void;
	onJumpToNote: () => Promise<void>;
	onRemoveContext: () => Promise<void>;
	onRemoveContextAndArchive: () => Promise<void>;
	onDeleteNote: () => Promise<void>;
	createButton: (container: HTMLElement, text: string, onClick: () => void | Promise<void>) => HTMLElement;
	showError: (message: string) => void;
}

export interface ActionHandler {
	getPromptText(): string;
	renderNoteContent(container: HTMLElement): Promise<void>;
	createButtons(buttonContainer: HTMLElement): void;
	initialize?(): Promise<void>;
	cleanup?(): void;
}

export abstract class BaseActionHandler implements ActionHandler {
	protected context: ActionHandlerContext;

	constructor(context: ActionHandlerContext) {
		this.context = context;
	}

	abstract getPromptText(): string;

	async renderNoteContent(container: HTMLElement): Promise<void> {
		// Default implementation - show full note content
		try {
			const noteContent = await this.context.app.vault.read(this.context.currentNote);
			if (!noteContent || noteContent.trim().length === 0) {
				container.createEl('div', { 
					text: 'This note is empty',
					cls: 'note-preview-empty'
				});
				container.style.fontStyle = 'italic';
				container.style.color = 'var(--text-muted)';
			} else {
				const { NoteRenderer } = await import('../utils/noteRenderer');
				await NoteRenderer.renderNoteContent(container, noteContent, this.context.currentNote, this.context.app, this.context.plugin);
			}
		} catch (error) {
			console.error('Error loading note content:', error);
			container.createEl('div', { 
				text: 'Could not load note preview',
				cls: 'note-preview-error'
			});
			container.style.color = 'var(--text-error)';
		}
	}

	createButtons(buttonContainer: HTMLElement): void {
		// Default implementation - standard buttons
		this.createStandardButtons(buttonContainer);
	}

	protected createStandardButtons(buttonContainer: HTMLElement): void {
		this.context.createButton(buttonContainer, 'Change Context', this.context.onChangeContext);
		this.context.createButton(buttonContainer, 'Jump to Note', this.context.onJumpToNote);
		this.context.createButton(buttonContainer, 'Remove Context', this.context.onRemoveContext);
		this.context.createButton(buttonContainer, 'Remove Context and Archive', this.context.onRemoveContextAndArchive);
		this.context.createButton(buttonContainer, 'Next', this.context.onNext);
	}

	cleanup(): void {
		// Override in subclasses if cleanup is needed
	}
}