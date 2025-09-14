import { TFile } from 'obsidian';
import { createEmptyCard, fsrs, Card, ReviewLog, FSRS, Grade, IPreview } from 'ts-fsrs';
import { NoteService } from '../noteService';

export class FSRSService {
	private noteService: NoteService;
	private scheduler: FSRS = fsrs();

	constructor(noteService: NoteService) {
		this.noteService = noteService;
	}

	/**
	 * Load FSRS card data from note frontmatter, or create empty card if none exists
	 */
	async loadCard(note: TFile): Promise<Card> {
		try {
			const frontmatter = await this.noteService.getFrontmatter(note);
			const cardData = frontmatter['see-you-again-learning-data'];

			if (cardData && this.isValidCardData(cardData)) {
				return this.deserializeCard(cardData);
			}
		} catch (error) {
			console.warn(`Failed to load FSRS card data for ${note.name}:`, error);
		}

		// Return empty card if no valid data exists
		return createEmptyCard();
	}

	/**
	 * Save FSRS card data to note frontmatter
	 */
	async saveCard(note: TFile, card: Card): Promise<void> {
		const cardData = this.serializeCard(card);
		await this.noteService.setFrontmatterProperty(note, 'see-you-again-learning-data', cardData);
	}

	/**
	 * Process a review rating and return updated card
	 */
	reviewCard(card: Card, grade: Grade, reviewDate: Date = new Date()): { card: Card; log: ReviewLog } {
		const schedulingInfo: IPreview = this.scheduler.repeat(card, reviewDate);
		const selectedResult = schedulingInfo[grade];
		return { card: selectedResult.card, log: selectedResult.log };
	}

	/**
	 * Check if a card is due for review
	 */
	isCardDue(card: Card, currentDate: Date = new Date()): boolean {
		return card.due <= currentDate;
	}

	/**
	 * Check if a note has FSRS data (is not unseen)
	 */
	async hasCardData(note: TFile): Promise<boolean> {
		try {
			const frontmatter = await this.noteService.getFrontmatter(note);
			const cardData = frontmatter['see-you-again-learning-data'];
			return cardData && this.isValidCardData(cardData);
		} catch (error) {
			return false;
		}
	}

	/**
	 * Get due date from card data without fully deserializing
	 */
	async getCardDueDate(note: TFile): Promise<Date | null> {
		try {
			const frontmatter = await this.noteService.getFrontmatter(note);
			const cardData = frontmatter['see-you-again-learning-data'];

			if (cardData && typeof cardData === 'object' && 'due' in cardData) {
				const typedCardData = cardData as { due: string };
				return new Date(typedCardData.due);
			}
		} catch (error) {
			console.warn(`Failed to get due date for ${note.name}:`, error);
		}

		return null;
	}

	private serializeCard(card: Card): any {
		return {
			...card,
			due: card.due.toISOString(),
			last_review: card.last_review?.toISOString()
		};
	}

	private deserializeCard(data: any): Card {
		return {
			...data,
			due: new Date(data.due),
			last_review: data.last_review ? new Date(data.last_review) : undefined
		};
	}

	private isValidCardData(data: any): boolean {
		return data &&
			typeof data.due === 'string' &&
			typeof data.stability === 'number' &&
			typeof data.difficulty === 'number' &&
			typeof data.elapsed_days === 'number' &&
			typeof data.scheduled_days === 'number' &&
			typeof data.reps === 'number' &&
			typeof data.lapses === 'number' &&
			typeof data.state === 'number';
	}
}