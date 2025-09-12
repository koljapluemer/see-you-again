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
			const revealButton = this.context.createStyledButton('Reveal', () => {
				this.revealNoteBody(container);
			});
			revealButton.style.marginBottom = '16px';
			container.appendChild(revealButton);

			// Store reference for later use
			(this as any).revealButton = revealButton;
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

		// Create the four spaced repetition buttons
		const wrongButton = this.context.createStyledButton('Wrong', async () => {
			await this.context.onNext();
		});
		wrongButton.style.backgroundColor = 'var(--color-red)';
		wrongButton.style.color = 'white';

		const hardButton = this.context.createStyledButton('Hard', async () => {
			await this.context.onNext();
		});
		hardButton.style.backgroundColor = 'var(--color-orange)';
		hardButton.style.color = 'white';

		const correctButton = this.context.createStyledButton('Correct', async () => {
			await this.context.onNext();
		});
		correctButton.style.backgroundColor = 'var(--color-green)';
		correctButton.style.color = 'white';

		const easyButton = this.context.createStyledButton('Easy', async () => {
			await this.context.onNext();
		});
		easyButton.style.backgroundColor = 'var(--color-blue)';
		easyButton.style.color = 'white';

		srButtonContainer.appendChild(wrongButton);
		srButtonContainer.appendChild(hardButton);
		srButtonContainer.appendChild(correctButton);
		srButtonContainer.appendChild(easyButton);
	}

	createButtons(buttonContainer: HTMLElement): void {
		// For memorize action, NO Done button - only the standard navigation buttons
		const changeContextButton = this.context.createStyledButton('Change Context', this.context.onChangeContext);
		const jumpButton = this.context.createStyledButton('Jump to Note', this.context.onJumpToNote);
		const nextButton = this.context.createStyledButton('Next', this.context.onNext);
		
		buttonContainer.appendChild(changeContextButton);
		buttonContainer.appendChild(jumpButton);
		buttonContainer.appendChild(nextButton);
	}

	cleanup(): void {
		this.isBodyRevealed = false;
		this.noteHeading = '';
		this.noteBody = '';
	}
}