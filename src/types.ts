export interface SeeYouAgainSettings {
	lastProcessedNote: string;
}

export const DEFAULT_SETTINGS: SeeYouAgainSettings = {
	lastProcessedNote: ''
};

export type ActionType = 'look-at' | 'memorize' | 'do' | 'iterate' | 'schedule' | 'improve';

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
	{ value: 'improve', label: 'Improve' }
];
