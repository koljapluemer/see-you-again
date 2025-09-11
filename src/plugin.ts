import { Plugin } from 'obsidian';
import { SeeYouAgainSettings, DEFAULT_SETTINGS } from './types';
import { AddContextModal } from './modals/addContextModal';
import { ContextBrowserModal } from './modals/contextBrowserModal';
import { SeeYouAgainSettingTab } from './settings';

export class SeeYouAgainPlugin extends Plugin {
	settings: SeeYouAgainSettings;

	async onload(): Promise<void> {
		await this.loadSettings();

		// Add command to open the Add Context modal
		this.addCommand({
			id: 'open-add-context-modal',
			name: 'Add context to random note',
			callback: () => {
				new AddContextModal(this.app, this).open();
			}
		});

		// Add command to start context browsing
		this.addCommand({
			id: 'start-context-browser',
			name: 'Start context...',
			callback: () => {
				new ContextBrowserModal(this.app, this).open();
			}
		});

		// Add settings tab
		this.addSettingTab(new SeeYouAgainSettingTab(this.app, this));
	}

	onunload(): void {
		// Clean up if needed
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
