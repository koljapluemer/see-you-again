import type { Grade, Card } from 'ts-fsrs';

import { BaseActionHandler } from './baseActionHandler';
import { FSRSService } from '../services/fsrsService';
import { NoteService } from '../noteService';

export class MemorizeActionHandler extends BaseActionHandler {
	private isBodyRevealed = false;
	private noteHeading = '';
	private noteBody = '';
	private isFillInBlank = false;
	private originalTitle = '';
	private titleWithBlank = '';
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

		// Parse the note content to separate heading and body
		const noteContent = await this.context.app.vault.read(this.context.currentNote);
		this.parseNoteContent(noteContent);

		// If fill-in-the-blank, prepare the title with blank
		if (this.isFillInBlank) {
			this.prepareFilLInBlank();
		} else if (!this.isFillInBlank) {
			// Check for partial reveal mode (has '---' separator)
			this.checkForPartialReveal();
		}
	}

	private parseNoteContent(content: string): void {
		// Remove frontmatter if present (proper YAML frontmatter detection)
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

		const lines = contentWithoutFrontmatter.split('\n');

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
			this.noteBody = contentWithoutFrontmatter.trim();
		}

		// Store original title for fill-in-the-blank
		this.originalTitle = this.noteHeading;

		// Store full content for partial reveal mode (raw content without frontmatter)
		this.fullContent = contentWithoutFrontmatter;
	}

	private checkForPartialReveal(): void {
		// Check if full content contains '---' separator
		const separatorIndex = this.fullContent.indexOf('---');
		if (separatorIndex !== -1) {
			this.hasPartialReveal = true;
			// Content before separator (just the raw content, no heading)
			this.contentBeforeSeparator = this.fullContent.substring(0, separatorIndex).trim();
		}
	}

	private prepareFilLInBlank(): void {
		// Extract text from heading (remove # symbols)
		const titleText = this.noteHeading.replace(/^#+\s*/, '');

		// Split into words and filter out empty strings and words with less than 3 characters
		const words = titleText.split(/\s+/).filter(word => word.length > 0);
		const eligibleWords = words.filter(word => word.length >= 3);

		if (eligibleWords.length === 0) {
			this.titleWithBlank = this.noteHeading;
			return;
		}

		// Choose a random eligible word to hide
		const randomEligibleWord = eligibleWords[Math.floor(Math.random() * eligibleWords.length)];

		// Find the index of this word in the original words array and replace it
		const wordIndex = words.indexOf(randomEligibleWord);
		words[wordIndex] = '＿';

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
			} else if (this.hasPartialReveal) {
				// For partial reveal mode, show content before '---'
				await this.renderPartialReveal(container);
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

	private async renderPartialReveal(container: HTMLElement): Promise<void> {
		const { NoteRenderer } = await import('../utils/noteRenderer');

		// Show filename as title
		const filenameTitle = `# ${this.context.currentNote.basename}`;
		await NoteRenderer.renderNoteContent(container, filenameTitle, this.context.currentNote, this.context.app, this.context.plugin);

		// Show content before separator if it exists
		if (this.contentBeforeSeparator) {
			await NoteRenderer.renderNoteContent(container, this.contentBeforeSeparator, this.context.currentNote, this.context.app, this.context.plugin);
		}

		const revealButtonEl = this.context.createButton(container, 'Reveal', () => {
			this.revealFullContent(container);
		});

		(this as any).revealButton = revealButtonEl;
		(this as any).contentContainer = container;
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

	private async revealFullContent(container: HTMLElement): Promise<void> {
		if (this.isBodyRevealed) {return;}

		this.isBodyRevealed = true;

		const revealButton = (this as any).revealButton;
		if (revealButton) {
			revealButton.remove();
		}

		// Re-render with filename as title + complete content
		container.empty();
		const { NoteRenderer } = await import('../utils/noteRenderer');

		// Show filename as title
		const filenameTitle = `# ${this.context.currentNote.basename}`;
		await NoteRenderer.renderNoteContent(container, filenameTitle, this.context.currentNote, this.context.app, this.context.plugin);

		// Show full content
		await NoteRenderer.renderNoteContent(container, this.fullContent, this.context.currentNote, this.context.app, this.context.plugin);

		this.addSpacedRepetitionButtons(container);
	}

	private async revealFillInBlank(container: HTMLElement): Promise<void> {
		if (this.isBodyRevealed) {return;}

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
		if (this.isBodyRevealed) {return;}

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

	private async scoreCard(grade: Grade): Promise<void> {
		if (!this.currentCard || !this.fsrsService) {
			console.error('No card or FSRS service available for scoring');
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

			console.log(`Card scored with grade ${grade}. Next due: ${updatedCard.due}`);

			// Move to next note
			await this.context.onNext();
		} catch (error) {
			console.error('Error scoring card:', error);
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
		this.noteHeading = '';
		this.noteBody = '';
		this.isFillInBlank = false;
		this.originalTitle = '';
		this.titleWithBlank = '';
		this.hasPartialReveal = false;
		this.contentBeforeSeparator = '';
		this.fullContent = '';
		this.currentCard = null;
	}
}