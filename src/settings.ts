import { App, PluginSettingTab, Setting, Plugin, Notice } from 'obsidian';
import { SeeYouAgainSettings } from './types';

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

		new Setting(containerEl)
			.setName('Last Processed Note')
			.setDesc('The last note that was processed (for internal tracking)')
			.addText(text => text
				.setPlaceholder('No note processed yet')
				.setValue(this.plugin.settings.lastProcessedNote)
				.setDisabled(true));

		new Setting(containerEl)
			.setName('Current Modal Note')
			.setDesc('The note currently shown in the modal (returns to this note when reopening)')
			.addText(text => text
				.setPlaceholder('No note currently active')
				.setValue(this.plugin.settings.currentModalNote)
				.setDisabled(true));

		// Add a button to reset/clear all processed notes
		new Setting(containerEl)
			.setName('Reset Processing History')
			.setDesc('Clear the tracking of which notes have been processed. This will make all notes available again.')
			.addButton(button => button
				.setButtonText('Reset All Notes')
				.setCta()
				.onClick(async () => {
					if (confirm('This will make all notes available for processing again. Continue?')) {
						await this.resetAllNotes();
					}
				}));

		// Stats section
		this.addStatsSection(containerEl);
	}

	private addStatsSection(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: 'Statistics' });
		
		const statsContainer = containerEl.createEl('div');
		statsContainer.style.cssText = 'margin: 16px 0; padding: 12px; background: var(--background-secondary); border-radius: 6px;';

		// We'll calculate and display stats about processed vs unprocessed notes
		this.calculateAndDisplayStats(statsContainer);
	}

	private async calculateAndDisplayStats(container: HTMLElement): Promise<void> {
		try {
			const allFiles = this.app.vault.getMarkdownFiles();
			let processedCount = 0;
			let unprocessedCount = 0;

			for (const file of allFiles) {
				const fileCache = this.app.metadataCache.getFileCache(file);
				const frontmatter = fileCache?.frontmatter;
				
				if (frontmatter && frontmatter['see-you-again']) {
					const seeYouAgain = frontmatter['see-you-again'];
					// Check if it has actual content (not empty array/object)
					if (Array.isArray(seeYouAgain) && seeYouAgain.length > 0) {
						processedCount++;
					} else if (typeof seeYouAgain === 'object' && Object.keys(seeYouAgain).length > 0) {
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
			console.error('Error calculating stats:', error);
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
				
				if (frontmatter && frontmatter['see-you-again']) {
					await this.app.fileManager.processFrontMatter(file, (fm) => {
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
			const statsContainer = this.containerEl.querySelector('div[style*="background: var(--background-secondary)"]') as HTMLElement;
			if (statsContainer) {
				await this.calculateAndDisplayStats(statsContainer);
			}

			// Show success message
			const notice = new Notice(`Reset ${resetCount} notes. All notes are now available for processing again.`);

		} catch (error) {
			console.error('Error resetting notes:', error);
			new Notice('Error resetting notes. Please try again.');
		}
	}
}
