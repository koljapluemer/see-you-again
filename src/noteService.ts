import type { App, TFile } from 'obsidian';

import type { SeeYouAgainFrontmatter, ActionType } from './types';
import { DateUtils } from './utils/dateUtils';
import { FSRSService } from './services/fsrsService';

export class NoteService {
	private fsrsService: FSRSService;

	constructor(private app: App) {
		this.fsrsService = new FSRSService(this);
	}

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
	 * Get all notes that have a specific context (sanitized key), prioritizing unseen notes
	 */
	async getNotesWithContext(sanitizedContext: string): Promise<TFile[]> {
		const allFiles = this.getAllMarkdownFiles();
		const unseenNotes: TFile[] = [];
		const seenNotes: TFile[] = [];

		for (const file of allFiles) {
			try {
				const fileCache = this.app.metadataCache.getFileCache(file);
				const frontmatter = fileCache?.frontmatter;
				
				if (frontmatter && frontmatter['see-you-again']) {
					const seeYouAgain = frontmatter['see-you-again'];
					
					// Handle object format (current implementation)
					if (typeof seeYouAgain === 'object' && !Array.isArray(seeYouAgain)) {
						if (seeYouAgain[sanitizedContext]) {
							// Check if note was seen today
							const lastSeen = frontmatter['seen-you-again'];
							if (this.wasSeenToday(lastSeen)) {
								seenNotes.push(file);
							} else {
								unseenNotes.push(file);
							}
						}
					}
				}
			} catch (error) {
				console.error('Error checking context in file:', file.path, error);
			}
		}

		// Return unseen notes first, then seen notes
		return [...unseenNotes, ...seenNotes];
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
	 * Get notes with a specific context that have a particular action type
	 * For memorize notes, filter by FSRS due date instead of seen-you-again timestamp
	 */
	async getNotesWithContextAndActionType(sanitizedContext: string, actionType: ActionType): Promise<TFile[]> {
		const allFiles = this.getAllMarkdownFiles();
		const matchingFiles: TFile[] = [];
		const unseenMemorizeFiles: TFile[] = [];
		const dueMemorizeFiles: TFile[] = [];
		const currentDate = new Date();

		for (const file of allFiles) {
			try {
				const fileCache = this.app.metadataCache.getFileCache(file);
				const frontmatter = fileCache?.frontmatter;

				if (frontmatter && frontmatter['see-you-again']) {
					const seeYouAgain = frontmatter['see-you-again'];

					// Handle object format (current implementation)
					if (typeof seeYouAgain === 'object' && !Array.isArray(seeYouAgain)) {
						// Check if this note has the context AND the specific action type
						if (seeYouAgain[sanitizedContext] === actionType) {
							if (actionType === 'memorize') {
								// For memorize notes, use FSRS due date logic
								const hasCardData = await this.fsrsService.hasCardData(file);
								if (!hasCardData) {
									// No FSRS data = unseen, add to unseen list
									unseenMemorizeFiles.push(file);
								} else {
									// Check if due for review
									const dueDate = await this.fsrsService.getCardDueDate(file);
									if (dueDate && dueDate <= currentDate) {
										dueMemorizeFiles.push(file);
									}
								}
							} else {
								// For other action types, use existing logic
								matchingFiles.push(file);
							}
						}
					}
				}
			} catch (error) {
				console.error('Error checking context and action type in file:', file.path, error);
			}
		}

		// For memorize notes: return up to 20 unseen, then due notes
		if (actionType === 'memorize') {
			const limitedUnseen = unseenMemorizeFiles.slice(0, 20);
			return [...limitedUnseen, ...dueMemorizeFiles];
		}

		return matchingFiles;
	}

	/**
	 * Get a random note with a specific context, prioritizing a specific action type
	 * Falls back to any action type if none found for the preferred type
	 */
	async getRandomNoteWithContextPrioritized(
		sanitizedContext: string, 
		preferredActionType: ActionType | null
	): Promise<{ file: TFile; actionType: ActionType } | null> {
		console.log(`[NoteService] Looking for notes with context "${sanitizedContext}", preferred action type: ${preferredActionType || 'any'}`);

		// First try to find notes with the preferred action type
		if (preferredActionType) {
			const preferredNotes = await this.getNotesWithContextAndActionType(sanitizedContext, preferredActionType);
			
			if (preferredNotes.length > 0) {
				const randomIndex = Math.floor(Math.random() * preferredNotes.length);
				const selectedFile = preferredNotes[randomIndex];
				
				console.log(`[NoteService] ✅ Found ${preferredNotes.length} notes with preferred action type "${preferredActionType}", selected: ${selectedFile.name}`);
				
				return {
					file: selectedFile,
					actionType: preferredActionType
				};
			} else {
				console.log(`[NoteService] ❌ No notes found with preferred action type "${preferredActionType}"`);
			}
		}

		// Fallback to any note with this context
		const allNotesWithContext = await this.getNotesWithContext(sanitizedContext);
		
		if (allNotesWithContext.length === 0) {
			console.log(`[NoteService] ❌ No notes found with context "${sanitizedContext}"`);
			return null;
		}

		const randomIndex = Math.floor(Math.random() * allNotesWithContext.length);
		const selectedFile = allNotesWithContext[randomIndex];
		
		// Get the action type for this file
		const frontmatter = await this.getFrontmatter(selectedFile);
		const actualActionType = frontmatter[sanitizedContext];
		
		console.log(`[NoteService] 📝 Fallback: Selected "${selectedFile.name}" with action type "${actualActionType}" (${allNotesWithContext.length} total options)`);
		
		return {
			file: selectedFile,
			actionType: actualActionType || 'look-at' // Default fallback
		};
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

	/**
	 * Check if a note was seen today (using human-day logic with 4am cutoff)
	 */
	private wasSeenToday(lastSeenDate: string | undefined): boolean {
		if (!lastSeenDate) {return false;}
		if (!DateUtils.isValidDateString(lastSeenDate)) {return false;}
		return DateUtils.isToday(lastSeenDate);
	}

	/**
	 * Mark a note as seen today
	 */
	async markNoteSeen(file: TFile): Promise<void> {
		try {
			const currentHumanDay = DateUtils.getCurrentHumanDay();
			await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
				frontmatter['seen-you-again'] = currentHumanDay;
			});
		} catch (error) {
			console.error('Error marking note as seen:', file.path, error);
			throw error;
		}
	}

	/**
	 * Remove a specific context from a note's see-you-again metadata
	 */
	async removeContext(file: TFile, sanitizedContext: string): Promise<void> {
		try {
			await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
				if (frontmatter['see-you-again'] && typeof frontmatter['see-you-again'] === 'object') {
					delete frontmatter['see-you-again'][sanitizedContext];
					
					// If no contexts remain, remove the entire see-you-again property
					if (Object.keys(frontmatter['see-you-again']).length === 0) {
						delete frontmatter['see-you-again'];
					}
				}
			});
		} catch (error) {
			console.error('Error removing context from note:', file.path, error);
			throw error;
		}
	}

	/**
	 * Move a note to the archive folder
	 */
	async archiveNote(file: TFile, archiveFolderPath: string): Promise<void> {
		try {
			// Ensure archive folder exists
			const archiveFolder = this.app.vault.getAbstractFileByPath(archiveFolderPath);
			if (!archiveFolder) {
				await this.app.vault.createFolder(archiveFolderPath);
			}
			
			// Generate new path in archive folder
			const newPath = `${archiveFolderPath}/${file.name}`;
			
			// Handle name conflicts by appending a number
			let finalPath = newPath;
			let counter = 1;
			while (this.app.vault.getAbstractFileByPath(finalPath)) {
				const baseName = file.basename;
				const extension = file.extension;
				finalPath = `${archiveFolderPath}/${baseName} ${counter}.${extension}`;
				counter++;
			}
			
			// Move the file
			await this.app.fileManager.renameFile(file, finalPath);
		} catch (error) {
			console.error('Error archiving note:', file.path, error);
			throw error;
		}
	}

	/**
	 * Set a specific property in note frontmatter
	 */
	async setFrontmatterProperty(file: TFile, property: string, value: any): Promise<void> {
		try {
			await this.app.fileManager.processFrontMatter(file, (frontmatter: any) => {
				frontmatter[property] = value;
			});
		} catch (error) {
			console.error(`Error setting frontmatter property ${property} for file:`, file.path, error);
			throw error;
		}
	}

	/**
	 * Delete a note from the vault
	 */
	async deleteNote(file: TFile): Promise<void> {
		try {
			await this.app.vault.delete(file);
		} catch (error) {
			console.error('Error deleting note:', file.path, error);
			throw error;
		}
	}
}
