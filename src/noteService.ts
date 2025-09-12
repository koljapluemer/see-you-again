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

	/**
	 * Check if a specific note is eligible (doesn't have see-you-again metadata)
	 */
	async isNoteEligible(file: TFile): Promise<boolean> {
		const hasMetadata = await this.hasExistingMetadata(file);
		return !hasMetadata;
	}

	/**
	 * Get all unique contexts that have been used in the past
	 */
	async getAllPastContexts(): Promise<string[]> {
		const allFiles = this.getAllMarkdownFiles();
		const contextSet = new Set<string>();

		for (const file of allFiles) {
			try {
				const fileCache = this.app.metadataCache.getFileCache(file);
				const frontmatter = fileCache?.frontmatter;
				
				if (frontmatter && frontmatter['see-you-again']) {
					const seeYouAgain = frontmatter['see-you-again'];
					
					// Handle object format (current implementation)
					if (typeof seeYouAgain === 'object' && !Array.isArray(seeYouAgain)) {
						Object.keys(seeYouAgain).forEach(context => {
							if (context && context.trim()) {
								// Hydrate: replace dashes with spaces for display
								const hydratedContext = context.replace(/-/g, ' ');
								contextSet.add(hydratedContext);
							}
						});
					}
				}
			} catch (error) {
				console.error('Error reading contexts from file:', file.path, error);
			}
		}

		return Array.from(contextSet).sort();
	}

	/**
	 * Get all notes that have a specific context (sanitized key)
	 */
	async getNotesWithContext(sanitizedContext: string): Promise<TFile[]> {
		const allFiles = this.getAllMarkdownFiles();
		const matchingFiles: TFile[] = [];

		for (const file of allFiles) {
			try {
				const fileCache = this.app.metadataCache.getFileCache(file);
				const frontmatter = fileCache?.frontmatter;
				
				if (frontmatter && frontmatter['see-you-again']) {
					const seeYouAgain = frontmatter['see-you-again'];
					
					// Handle object format (current implementation)
					if (typeof seeYouAgain === 'object' && !Array.isArray(seeYouAgain)) {
						if (seeYouAgain[sanitizedContext]) {
							matchingFiles.push(file);
						}
					}
				}
			} catch (error) {
				console.error('Error checking context in file:', file.path, error);
			}
		}

		return matchingFiles;
	}

	/**
	 * Get a random note with a specific context
	 */
	async getRandomNoteWithContext(sanitizedContext: string): Promise<TFile | null> {
		const notesWithContext = await this.getNotesWithContext(sanitizedContext);
		
		if (notesWithContext.length === 0) {
			return null;
		}

		const randomIndex = Math.floor(Math.random() * notesWithContext.length);
		return notesWithContext[randomIndex];
	}

	/**
	 * Get existing see-you-again frontmatter for a file
	 */
	async getFrontmatter(file: TFile): Promise<SeeYouAgainFrontmatter> {
		try {
			const fileCache = this.app.metadataCache.getFileCache(file);
			const frontmatter = fileCache?.frontmatter;
			
			if (frontmatter && frontmatter['see-you-again']) {
				const seeYouAgain = frontmatter['see-you-again'];
				
				// Handle object format (current implementation)
				if (typeof seeYouAgain === 'object' && !Array.isArray(seeYouAgain)) {
					return seeYouAgain;
				}
			}
			
			return {};
		} catch (error) {
			console.error('Error getting frontmatter for file:', file.path, error);
			return {};
		}
	}
}
