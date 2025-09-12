import { Plugin } from 'obsidian';
import { SeeYouAgainSettings, DEFAULT_SETTINGS } from './types';
import { AddContextModal } from './modals/addContextModal';
import { BatchAddContextModal } from './modals/batchAddContextModal';
import { ContextBrowserModal } from './modals/contextBrowserModal';
import { CurrentNoteContextModal } from './modals/currentNoteContextModal';
import { SeeYouAgainSettingTab } from './settings';
import { StateManager } from './state/stateManager';

export class SeeYouAgainPlugin extends Plugin {
	settings: SeeYouAgainSettings;
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

		// Add command to manage contexts for currently open note
		this.addCommand({
			id: 'manage-current-note-contexts',
			name: 'Manage contexts for currently open note',
			callback: () => {
				new CurrentNoteContextModal(this.app, this).open();
			}
		});

		// Add sidebar button for managing contexts
		this.addRibbonIcon('tags', 'Manage contexts for current note', (evt: MouseEvent) => {
			new CurrentNoteContextModal(this.app, this).open();
		});

		// Add settings tab
		this.addSettingTab(new SeeYouAgainSettingTab(this.app, this));
	}

	onunload(): void {
		// Plugin cleanup
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
