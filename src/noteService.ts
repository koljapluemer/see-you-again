import { App, TFile } from 'obsidian';
import { SeeYouAgainFrontmatter } from './types';

export class NoteService {
	constructor(private app: App) {}

	/**
	 * Get all markdown files in the vault
	 */
	private getAllMarkdownFiles(): TFile[] {
		return this.app.vault.getMarkdownFiles();
	}

	/**
	 * Check if a note already has see-you-again frontmatter
	 */
	private async hasExistingMetadata(file: TFile): Promise<boolean> {
		try {
			const fileCache = this.app.metadataCache.getFileCache(file);
			const frontmatter = fileCache?.frontmatter;
			
			if (!frontmatter || !frontmatter['see-you-again']) {
				return false;
			}

			const seeYouAgain = frontmatter['see-you-again'];
			// Check if it's an empty array/object or has actual content
			if (Array.isArray(seeYouAgain)) {
				return seeYouAgain.length > 0;
			}
			if (typeof seeYouAgain === 'object') {
				return Object.keys(seeYouAgain).length > 0;
			}
			
			return true;
		} catch (error) {
			console.error('Error checking frontmatter for file:', file.path, error);
			return false;
		}
	}

	/**
	 * Get eligible notes (those without existing see-you-again metadata)
	 */
	async getEligibleNotes(): Promise<TFile[]> {
		const allFiles = this.getAllMarkdownFiles();
		const eligibleNotes: TFile[] = [];

		for (const file of allFiles) {
			const hasMetadata = await this.hasExistingMetadata(file);
			if (!hasMetadata) {
				eligibleNotes.push(file);
			}
		}

		return eligibleNotes;
	}

	/**
	 * Get a random note from eligible notes
	 */
	async getRandomNote(): Promise<TFile | null> {
		const eligibleNotes = await this.getEligibleNotes();
		
		if (eligibleNotes.length === 0) {
			return null;
		}

		const randomIndex = Math.floor(Math.random() * eligibleNotes.length);
		return eligibleNotes[randomIndex];
	}

	/**
	 * Save see-you-again metadata to a note's frontmatter
	 */
	async saveMetadata(file: TFile, metadata: SeeYouAgainFrontmatter): Promise<void> {
		try {
			await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
				frontmatter['see-you-again'] = metadata;
			});
		} catch (error) {
			console.error('Error saving metadata to file:', file.path, error);
			throw error;
		}
	}

	/**
	 * Set empty see-you-again metadata (for exclude action)
	 */
	async excludeNote(file: TFile): Promise<void> {
		await this.saveMetadata(file, {});
	}
}
