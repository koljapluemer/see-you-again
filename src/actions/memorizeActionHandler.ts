import type { Grade, Card } from 'ts-fsrs';

import { BaseActionHandler } from './baseActionHandler';
import { FSRSService } from '../services/fsrsService';
import { NoteService } from '../noteService';

export class MemorizeActionHandler extends BaseActionHandler {
	private isBodyRevealed = false;
	private isFillInBlank = false;
	private hasPartialReveal = false;
	private contentBeforeSeparator = '';
	private fullContent = '';
	private fsrsService: FSRSService | undefined;
	private currentCard: Card | null = null;

	async initialize(): Promise<void> {
		// Initialize FSRS service
		const noteService = new NoteService(this.context.app);
		this.fsrsService = new FSRSService(noteService);

		// Load FSRS card data
		this.currentCard = await this.fsrsService.loadCard(this.context.currentNote);

		// Check if this is a fill-in-the-blank note (filename starts with ">")
		this.isFillInBlank = this.context.currentNote.basename.startsWith('>');

		// Check for partial reveal mode (has '---' separator)
		if (!this.isFillInBlank) {
			const noteContent = await this.context.app.vault.read(this.context.currentNote);
			this.checkForPartialReveal(noteContent);
		}
	}

	private checkForPartialReveal(content: string): void {
		// Remove frontmatter if present
		let contentWithoutFrontmatter = content;
		if (content.startsWith('---\n')) {
			const lines = content.split('\n');
			let endIndex = -1;
			for (let i = 1; i < lines.length; i++) {
				if (lines[i] === '---') {
					endIndex = i;
					break;
				}
			}
			if (endIndex !== -1) {
				contentWithoutFrontmatter = lines.slice(endIndex + 1).join('\n').trim();
			}
		}

		// Store full content for partial reveal mode
		this.fullContent = contentWithoutFrontmatter;

		// Check if content contains '---' separator
		const separatorIndex = this.fullContent.indexOf('---');
		if (separatorIndex !== -1) {
			this.hasPartialReveal = true;
			this.contentBeforeSeparator = this.fullContent.substring(0, separatorIndex).trim();
		}
	}

	getPromptText(): string {
		return 'think of the answer';
	}

	async renderNoteContent(container: HTMLElement): Promise<void> {
		try {
			if (this.isFillInBlank) {
				// For fill-in-the-blank notes, show title with blank and full body immediately
				await this.renderFillInBlank(container);
			} else if (this.hasPartialReveal) {
				// For partial reveal mode, show content before '---'
				await this.renderPartialReveal(container);
			} else {
				// Standard mode: show title only, then reveal button
				const { NoteRenderer } = await import('../utils/noteRenderer');
				const titleOnly = `# ${this.context.currentNote.basename}`;
				NoteRenderer.renderNoteContent(container, titleOnly, this.context.currentNote, this.context.app, this.context.plugin);

				const revealButtonEl = this.context.createButton(container, 'Reveal', () => {
					void this.revealNoteBody(container);
				});

				(this as { revealButton?: HTMLElement }).revealButton = revealButtonEl;
				(this as { contentContainer?: HTMLElement }).contentContainer = container;
			}

		} catch (error) {
			container.createEl('div', {
				text: 'Could not load note content',
				cls: 'note-preview-error'
			});
			}
	}

	private async renderPartialReveal(container: HTMLElement): Promise<void> {
		const { NoteRenderer } = await import('../utils/noteRenderer');

		// Show filename as title
		const filenameTitle = `# ${this.context.currentNote.basename}`;
		NoteRenderer.renderNoteContent(container, filenameTitle, this.context.currentNote, this.context.app, this.context.plugin);

		// Show content before separator if it exists
		if (this.contentBeforeSeparator) {
			NoteRenderer.renderNoteContent(container, this.contentBeforeSeparator, this.context.currentNote, this.context.app, this.context.plugin);
		}

		const revealButtonEl = this.context.createButton(container, 'Reveal', () => {
			void this.revealFullContent(container);
		});

		(this as { revealButton?: HTMLElement }).revealButton = revealButtonEl;
		(this as { contentContainer?: HTMLElement }).contentContainer = container;
	}

	private async renderFillInBlank(container: HTMLElement): Promise<void> {
		const { NoteRenderer } = await import('../utils/noteRenderer');

		// Show filename with blank
		const titleWithBlank = `# ${this.context.currentNote.basename.replace(/^>/, '').replace(/\b\w{3,}\b/, '＿')}`;
		NoteRenderer.renderNoteContent(container, titleWithBlank, this.context.currentNote, this.context.app, this.context.plugin);

		// Show note content
		const noteContent = await this.context.app.vault.read(this.context.currentNote);
		NoteRenderer.renderNoteContent(container, noteContent, this.context.currentNote, this.context.app, this.context.plugin);

		const revealButtonEl = this.context.createButton(container, 'Reveal', () => {
			void this.revealFillInBlank(container);
		});

		(this as { revealButton?: HTMLElement }).revealButton = revealButtonEl;
		(this as { contentContainer?: HTMLElement }).contentContainer = container;
	}

	private async revealFullContent(container: HTMLElement): Promise<void> {
		if (this.isBodyRevealed) {return;}

		this.isBodyRevealed = true;

		const revealButton = (this as { revealButton?: HTMLElement }).revealButton;
		if (revealButton) {
			revealButton.remove();
		}

		// Re-render with filename as title + complete content
		container.empty();
		const { NoteRenderer } = await import('../utils/noteRenderer');

		// Show filename as title
		const filenameTitle = `# ${this.context.currentNote.basename}`;
		NoteRenderer.renderNoteContent(container, filenameTitle, this.context.currentNote, this.context.app, this.context.plugin);

		// Show full content
		NoteRenderer.renderNoteContent(container, this.fullContent, this.context.currentNote, this.context.app, this.context.plugin);

		this.addSpacedRepetitionButtons(container);
	}

	private async revealFillInBlank(container: HTMLElement): Promise<void> {
		if (this.isBodyRevealed) {return;}

		this.isBodyRevealed = true;

		const revealButton = (this as { revealButton?: HTMLElement }).revealButton;
		if (revealButton) {
			revealButton.remove();
		}

		// Re-render with complete title and content
		container.empty();
		const { NoteRenderer } = await import('../utils/noteRenderer');

		// Show complete filename (remove > prefix)
		const completeTitle = `# ${this.context.currentNote.basename.replace(/^>/, '')}`;
		NoteRenderer.renderNoteContent(container, completeTitle, this.context.currentNote, this.context.app, this.context.plugin);

		// Show full note content
		const noteContent = await this.context.app.vault.read(this.context.currentNote);
		NoteRenderer.renderNoteContent(container, noteContent, this.context.currentNote, this.context.app, this.context.plugin);

		this.addSpacedRepetitionButtons(container);
	}

	private async revealNoteBody(container: HTMLElement): Promise<void> {
		if (this.isBodyRevealed) {return;}

		this.isBodyRevealed = true;

		const revealButton = (this as { revealButton?: HTMLElement }).revealButton;
		if (revealButton) {
			revealButton.remove();
		}

		// Show the full note content
		const { NoteRenderer } = await import('../utils/noteRenderer');
		const noteContent = await this.context.app.vault.read(this.context.currentNote);
		NoteRenderer.renderNoteContent(container, noteContent, this.context.currentNote, this.context.app, this.context.plugin);

		this.addSpacedRepetitionButtons(container);
	}

	private async scoreCard(grade: Grade): Promise<void> {
		if (!this.currentCard || !this.fsrsService) {
			await this.context.onNext();
			return;
		}

		try {
			// Review the card with the given grade
			const { card: updatedCard } = this.fsrsService.reviewCard(this.currentCard, grade);

			// Save the updated card data to frontmatter
			await this.fsrsService.saveCard(this.context.currentNote, updatedCard);

			// Update current card reference
			this.currentCard = updatedCard;


			// Move to next note
			await this.context.onNext();
		} catch (error) {
			this.context.showError('Failed to save spaced repetition data');
			await this.context.onNext();
		}
	}

	private addSpacedRepetitionButtons(container: HTMLElement): void {
		const srButtonContainer = container.createEl('div');
		srButtonContainer.className = 'modal-button-row';

		// Create the four spaced repetition buttons with FSRS scoring
		this.context.createButton(srButtonContainer, 'Wrong', async () => {
			await this.scoreCard(1); // Grade.Again
		});

		this.context.createButton(srButtonContainer, 'Hard', async () => {
			await this.scoreCard(2); // Grade.Hard
		});

		this.context.createButton(srButtonContainer, 'Correct', async () => {
			await this.scoreCard(3); // Grade.Good
		});

		this.context.createButton(srButtonContainer, 'Easy', async () => {
			await this.scoreCard(4); // Grade.Easy
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
		this.isFillInBlank = false;
		this.hasPartialReveal = false;
		this.contentBeforeSeparator = '';
		this.fullContent = '';
		this.currentCard = null;
	}
}