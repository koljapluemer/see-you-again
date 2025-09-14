import type { App } from 'obsidian';
import { AbstractInputSuggest } from 'obsidian';

export class ContextInputSuggest extends AbstractInputSuggest<string> {
	private pastContexts: string[] = [];
	private onSelectCallback: (value: string) => void;

	constructor(
		app: App,
		inputEl: HTMLInputElement,
		pastContexts: string[] = [],
		onSelect?: (value: string) => void
	) {
		super(app, inputEl);
		this.pastContexts = pastContexts;
		this.onSelectCallback = onSelect || (() => {});
	}

	getSuggestions(query: string): string[] {
		const queryLowerCase = query.toLowerCase();
		
		// Filter contexts that contain the query (fuzzy-ish matching)
		return this.pastContexts
			.filter(context => context.toLowerCase().includes(queryLowerCase))
			.sort((a, b) => {
				// Prioritize exact matches at the beginning
				const aIndex = a.toLowerCase().indexOf(queryLowerCase);
				const bIndex = b.toLowerCase().indexOf(queryLowerCase);
				
				if (aIndex !== bIndex) {
					return aIndex - bIndex;
				}
				
				// Then sort alphabetically
				return a.localeCompare(b);
			})
			.slice(0, 8); // Limit to 8 suggestions like our previous implementation
	}

	renderSuggestion(suggestion: string, el: HTMLElement): void {
		el.createEl('div', { 
			text: suggestion,
			cls: 'context-suggestion-item'
		});
	}

	selectSuggestion(suggestion: string): void {
		this.setValue(suggestion);
		this.onSelectCallback(suggestion);
	}

	updateSuggestions(newContexts: string[]): void {
		this.pastContexts = newContexts;
	}

	destroy(): void {
		this.close();
	}
}