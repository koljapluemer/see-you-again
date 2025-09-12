import { Plugin } from 'obsidian';
import { StateManager } from './state/stateManager';

export interface SeeYouAgainSettings {
	lastProcessedNote: string;
	currentModalNote: string;
	archiveFolder: string;
}

export interface SeeYouAgainPlugin extends Plugin {
	settings: SeeYouAgainSettings;
	saveSettings(): Promise<void>;
	stateManager: StateManager;
}

export const DEFAULT_SETTINGS: SeeYouAgainSettings = {
	lastProcessedNote: '',
	currentModalNote: '',
	archiveFolder: 'Archive'
};

export type ActionType = 'look-at' | 'memorize' | 'do' | 'iterate' | 'schedule' | 'improve' | 'evaluate';

export interface ContextEntry {
	context: string;
	action: ActionType;
}

export interface SeeYouAgainFrontmatter {
	[context: string]: ActionType;
}

export const ACTION_OPTIONS: { value: ActionType; label: string }[] = [
	{ value: 'look-at', label: 'Look At' },
	{ value: 'memorize', label: 'Memorize' },
	{ value: 'do', label: 'Do' },
	{ value: 'iterate', label: 'Iterate' },
	{ value: 'schedule', label: 'Schedule' },
	{ value: 'improve', label: 'Improve' },
	{ value: 'evaluate', label: 'Evaluate'}
];
