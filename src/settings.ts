import type { App, Plugin} from 'obsidian';
import { PluginSettingTab, Setting, Notice } from 'obsidian';

import type { SeeYouAgainSettings } from './types';
import { FolderSuggest } from './utils/folderSuggester';

export class SeeYouAgainSettingTab extends PluginSettingTab {
	plugin: Plugin & { settings: SeeYouAgainSettings; saveSettings(): Promise<void> };

	constructor(app: App, plugin: Plugin & { settings: SeeYouAgainSettings; saveSettings(): Promise<void> }) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'See You Again Settings' });

		// Archive Folder setting
		new Setting(containerEl)
			.setName('Archive Folder')
			.setDesc('Folder where notes will be moved when using "Remove Context and Archive"')
			.addSearch(search => {
				const saveFolder = async (value: string): Promise<void> => {
					// Trim folder and Strip ending slash if there
					let newFolder = value.trim();
					newFolder = newFolder.replace(/\/$/, "");
					this.plugin.settings.archiveFolder = newFolder || 'Archive';
					await this.plugin.saveSettings();
				};

				new FolderSuggest(this.app, search.inputEl, (value: string) => {
					saveFolder(value).catch(error => console.error('Folder save failed:', error));
				});
				search
					.setPlaceholder('Archive')
					.setValue(this.plugin.settings.archiveFolder);
				
				// Save on blur (for manual typing)
				search.inputEl.addEventListener('blur', () => {
					saveFolder(search.inputEl.value).catch(error => console.error('Save folder failed:', error));
				});
			});

		// Add a button to reset/clear all processed notes
		new Setting(containerEl)
			.setName('Reset All Notes')
			.setDesc('Clear all "see-you-again" metadata from your notes. This will make all notes available for processing again.')
			.addButton(button => button
				.setButtonText('Reset All Notes')
				.setCta()
				.onClick(async () => {
					if (confirm('This will remove all "see-you-again" metadata from your notes and make them available for processing again. Continue?')) {
						await this.resetAllNotes();
					}
				}));

		// Stats section
		this.addStatsSection(containerEl);
	}

	private addStatsSection(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: 'Statistics' });
		
		const statsContainer = containerEl.createEl('div');
		statsContainer.className = 'see-you-again-stats-container';

		// We'll calculate and display stats about processed vs unprocessed notes
		this.calculateAndDisplayStats(statsContainer);
	}

	private calculateAndDisplayStats(container: HTMLElement): void {
		try {
			const allFiles = this.app.vault.getMarkdownFiles();
			let processedCount = 0;
			let unprocessedCount = 0;

			for (const file of allFiles) {
				const fileCache = this.app.metadataCache.getFileCache(file);
				const frontmatter = fileCache?.frontmatter;
				
				if (frontmatter && typeof frontmatter === 'object' && 'see-you-again' in frontmatter) {
					const seeYouAgain: unknown = frontmatter['see-you-again'];
					// Check if it has actual content (not empty array/object)
					if (Array.isArray(seeYouAgain) && seeYouAgain.length > 0) {
						processedCount++;
					} else if (typeof seeYouAgain === 'object' && seeYouAgain !== null && Object.keys(seeYouAgain).length > 0) {
						processedCount++;
					} else {
						// Empty array/object counts as excluded, not processed
						processedCount++;
					}
				} else {
					unprocessedCount++;
				}
			}

			container.innerHTML = '';
			container.createEl('div', { text: `Total notes: ${allFiles.length}` });
			container.createEl('div', { text: `Processed/Excluded: ${processedCount}` });
			container.createEl('div', { text: `Available for processing: ${unprocessedCount}` });
			
			const percentage = allFiles.length > 0 ? Math.round((processedCount / allFiles.length) * 100) : 0;
			container.createEl('div', { text: `Progress: ${percentage}%` });

		} catch (error) {
			container.createEl('div', { text: 'Error calculating statistics' });
		}
	}

	private async resetAllNotes(): Promise<void> {
		try {
			const allFiles = this.app.vault.getMarkdownFiles();
			let resetCount = 0;

			for (const file of allFiles) {
				const fileCache = this.app.metadataCache.getFileCache(file);
				const frontmatter = fileCache?.frontmatter;
				
				if (frontmatter && typeof frontmatter === 'object' && 'see-you-again' in frontmatter) {
					await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
						delete fm['see-you-again'];
					});
					resetCount++;
				}
			}

			// Reset plugin settings
			this.plugin.settings.lastProcessedNote = '';
			this.plugin.settings.currentModalNote = '';
			await this.plugin.saveSettings();

			// Refresh the stats display
			const statsContainer = this.containerEl.querySelector('.see-you-again-stats-container') as HTMLElement;
			if (statsContainer !== null) {
				this.calculateAndDisplayStats(statsContainer);
			}

			// Show success message
			new Notice(`Reset ${resetCount} notes. All notes are now available for processing again.`);

		} catch (error) {
			new Notice('Error resetting notes. Please try again.');
		}
	}
}
