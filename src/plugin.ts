import { Plugin } from 'obsidian';
import { SeeYouAgainSettings, DEFAULT_SETTINGS } from './types';
import { AddContextModal } from './modals/addContextModal';
import { BatchAddContextModal } from './modals/batchAddContextModal';
import { ContextBrowserModal } from './modals/contextBrowserModal';
import { SeeYouAgainSettingTab } from './settings';
import { ToolbarManager } from './components/toolbarManager';
import { StateManager } from './state/stateManager';

export class SeeYouAgainPlugin extends Plugin {
	settings: SeeYouAgainSettings;
	toolbarManager: ToolbarManager;
	stateManager: StateManager;

	async onload(): Promise<void> {
		await this.loadSettings();

		// Initialize state manager
		this.stateManager = new StateManager();

		// Add command to open the Add Context modal
		this.addCommand({
			id: 'open-add-context-modal',
			name: 'Add context to random note',
			callback: () => {
				new AddContextModal(this.app, this).open();
			}
		});

		// Add command to batch-update contexts from search results
		this.addCommand({
			id: 'batch-add-context-from-search',
			name: 'Batch add contexts from search results',
			callback: () => {
				new BatchAddContextModal(this.app, this).open();
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

		// Initialize toolbar manager
		this.toolbarManager = new ToolbarManager(this.app, this);
	}

	onunload(): void {
		// Clean up toolbar manager
		if (this.toolbarManager) {
			this.toolbarManager.destroy();
		}
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
