import { ButtonComponent } from 'obsidian';
import { BaseActionHandler } from './baseActionHandler';

export class MemorizeActionHandler extends BaseActionHandler {
	private isBodyRevealed: boolean = false;
	private noteHeading: string = '';
	private noteBody: string = '';
	private isFillInBlank: boolean = false;
	private originalTitle: string = '';
	private titleWithBlank: string = '';
	private hiddenWord: string = '';

	async initialize(): Promise<void> {
		// Check if this is a fill-in-the-blank note (filename starts with ">")
		this.isFillInBlank = this.context.currentNote.basename.startsWith('>');

		// Parse the note content to separate heading and body
		const noteContent = await this.context.app.vault.read(this.context.currentNote);
		this.parseNoteContent(noteContent);

		// If fill-in-the-blank, prepare the title with blank
		if (this.isFillInBlank) {
			this.prepareFilLInBlank();
		}
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

		// Store original title for fill-in-the-blank
		this.originalTitle = this.noteHeading;
	}

	private prepareFilLInBlank(): void {
		// Extract text from heading (remove # symbols)
		const titleText = this.noteHeading.replace(/^#+\s*/, '');

		// Split into words and filter out empty strings
		const words = titleText.split(/\s+/).filter(word => word.length > 0);

		if (words.length === 0) {
			this.titleWithBlank = this.noteHeading;
			return;
		}

		// Choose a random word to hide
		const randomIndex = Math.floor(Math.random() * words.length);
		this.hiddenWord = words[randomIndex];

		// Replace the word with a blank
		words[randomIndex] = '＿';

		// Reconstruct the heading with the same # symbols
		const headingPrefix = this.noteHeading.match(/^#+\s*/)?.[0] || '# ';
		this.titleWithBlank = headingPrefix + words.join(' ');
	}

	getPromptText(): string {
		return 'think of the answer';
	}

	async renderNoteContent(container: HTMLElement): Promise<void> {
		try {
			if (this.isFillInBlank) {
				// For fill-in-the-blank notes, show title with blank and full body immediately
				await this.renderFillInBlank(container);
			} else {
				// Show heading only, then reveal button
				const { NoteRenderer } = await import('../utils/noteRenderer');
				await NoteRenderer.renderNoteContent(container, this.noteHeading, this.context.currentNote, this.context.app, this.context.plugin);

				const revealButtonEl = this.context.createButton(container, 'Reveal', () => {
					this.revealNoteBody(container);
				});

				(this as any).revealButton = revealButtonEl;
				(this as any).contentContainer = container;
			}

		} catch (error) {
			console.error('Error rendering memorize content:', error);
			container.createEl('div', {
				text: 'Could not load note content',
				cls: 'note-preview-error'
			});
			container.style.color = 'var(--text-error)';
		}
	}

	private async renderFillInBlank(container: HTMLElement): Promise<void> {
		const { NoteRenderer } = await import('../utils/noteRenderer');

		// Show title with blank
		await NoteRenderer.renderNoteContent(container, this.titleWithBlank, this.context.currentNote, this.context.app, this.context.plugin);

		// Show body if it exists
		if (this.noteBody) {
			await NoteRenderer.renderNoteContent(container, this.noteBody, this.context.currentNote, this.context.app, this.context.plugin);
		}

		const revealButtonEl = this.context.createButton(container, 'Reveal', () => {
			this.revealFillInBlank(container);
		});

		(this as any).revealButton = revealButtonEl;
		(this as any).contentContainer = container;
	}

	private async revealFillInBlank(container: HTMLElement): Promise<void> {
		if (this.isBodyRevealed) return;

		this.isBodyRevealed = true;

		const revealButton = (this as any).revealButton;
		if (revealButton) {
			revealButton.remove();
		}

		// Re-render with complete title
		container.empty();
		const { NoteRenderer } = await import('../utils/noteRenderer');
		await NoteRenderer.renderNoteContent(container, this.originalTitle, this.context.currentNote, this.context.app, this.context.plugin);

		if (this.noteBody) {
			await NoteRenderer.renderNoteContent(container, this.noteBody, this.context.currentNote, this.context.app, this.context.plugin);
		}

		this.addSpacedRepetitionButtons(container);
	}

	private async revealNoteBody(container: HTMLElement): Promise<void> {
		if (this.isBodyRevealed) return;

		this.isBodyRevealed = true;

		const revealButton = (this as any).revealButton;
		if (revealButton) {
			revealButton.remove();
		}

		// Show the full note content
		if (this.noteBody) {
			const { NoteRenderer } = await import('../utils/noteRenderer');
			await NoteRenderer.renderNoteContent(container, this.noteBody, this.context.currentNote, this.context.app, this.context.plugin);
		}

		this.addSpacedRepetitionButtons(container);
	}

	private addSpacedRepetitionButtons(container: HTMLElement): void {
		const srButtonContainer = container.createEl('div');
		srButtonContainer.className = 'modal-button-row';

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
		this.isFillInBlank = false;
		this.originalTitle = '';
		this.titleWithBlank = '';
		this.hiddenWord = '';
	}
}