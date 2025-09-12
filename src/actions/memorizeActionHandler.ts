import { ButtonComponent } from 'obsidian';
import { BaseActionHandler } from './baseActionHandler';

export class MemorizeActionHandler extends BaseActionHandler {
	private isBodyRevealed: boolean = false;
	private noteHeading: string = '';
	private noteBody: string = '';

	async initialize(): Promise<void> {
		// Parse the note content to separate heading and body
		const noteContent = await this.context.app.vault.read(this.context.currentNote);
		this.parseNoteContent(noteContent);
	}

	private parseNoteContent(content: string): void {
		const lines = content.split('\n');
		
		// Find the first heading (line starting with #)
		let headingIndex = -1;
		for (let i = 0; i < lines.length; i++) {
			if (lines[i].trim().startsWith('#')) {
				headingIndex = i;
				break;
			}
		}

		if (headingIndex >= 0) {
			this.noteHeading = lines[headingIndex];
			// Body is everything after the heading
			this.noteBody = lines.slice(headingIndex + 1).join('\n').trim();
		} else {
			// No heading found, use the note title as heading and full content as body
			this.noteHeading = `# ${this.context.currentNote.basename}`;
			this.noteBody = content.trim();
		}
	}

	getPromptText(): string {
		return 'think of the answer';
	}

	async renderNoteContent(container: HTMLElement): Promise<void> {
		try {
			// Just show the reveal button - the heading is already shown in the modal header
			const revealButtonEl = this.context.createButton(container, 'Reveal', () => {
				this.revealNoteBody(container);
			});
			revealButtonEl.style.marginBottom = '16px';

			// Store reference for later use
			(this as any).revealButton = revealButtonEl;
			(this as any).contentContainer = container;

		} catch (error) {
			console.error('Error rendering memorize content:', error);
			container.createEl('div', { 
				text: 'Could not load note content',
				cls: 'note-preview-error'
			});
			container.style.color = 'var(--text-error)';
		}
	}

	private async revealNoteBody(container: HTMLElement): Promise<void> {
		if (this.isBodyRevealed) return;
		
		this.isBodyRevealed = true;
		
		// Hide the reveal button
		const revealButton = (this as any).revealButton;
		if (revealButton) {
			revealButton.style.display = 'none';
		}

		// Show the note body
		const bodyContainer = container.createEl('div');
		bodyContainer.className = 'memorize-body';
		bodyContainer.style.marginTop = '16px';
		bodyContainer.style.marginBottom = '16px';

		if (this.noteBody) {
			const { NoteRenderer } = await import('../utils/noteRenderer');
			await NoteRenderer.renderNoteContent(bodyContainer, this.noteBody, this.context.currentNote, this.context.app, this.context.plugin);
		} else {
			bodyContainer.createEl('div', { 
				text: 'No additional content in this note',
				cls: 'note-preview-empty'
			});
			bodyContainer.style.fontStyle = 'italic';
			bodyContainer.style.color = 'var(--text-muted)';
		}

		// Add spaced repetition buttons after the body
		this.addSpacedRepetitionButtons(container);
	}

	private addSpacedRepetitionButtons(container: HTMLElement): void {
		const srButtonContainer = container.createEl('div');
		srButtonContainer.className = 'spaced-repetition-buttons';
		srButtonContainer.style.display = 'flex';
		srButtonContainer.style.gap = '8px';
		srButtonContainer.style.marginTop = '16px';
		srButtonContainer.style.justifyContent = 'center';

		// Create the four spaced repetition buttons with standard Obsidian styling
		this.context.createButton(srButtonContainer, 'Wrong', async () => {
			await this.context.onNext();
		});

		this.context.createButton(srButtonContainer, 'Hard', async () => {
			await this.context.onNext();
		});

		this.context.createButton(srButtonContainer, 'Correct', async () => {
			await this.context.onNext();
		});

		this.context.createButton(srButtonContainer, 'Easy', async () => {
			await this.context.onNext();
		});
	}

	createButtons(buttonContainer: HTMLElement): void {
		// For memorize action, NO Done button - only the standard navigation buttons
		this.context.createButton(buttonContainer, 'Change Context', this.context.onChangeContext);
		this.context.createButton(buttonContainer, 'Jump to Note', this.context.onJumpToNote);
		this.context.createButton(buttonContainer, 'Next', this.context.onNext);
	}

	cleanup(): void {
		this.isBodyRevealed = false;
		this.noteHeading = '';
		this.noteBody = '';
	}
}