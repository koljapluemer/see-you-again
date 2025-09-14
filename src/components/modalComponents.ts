import type { TextComponent, App } from 'obsidian';
import { Setting } from 'obsidian';

import type { ContextEntry, ActionType} from '../types';
import { ACTION_OPTIONS } from '../types';
import { ContextInputSuggest } from './contextSuggest';


export class ContextFieldManager {
	private container: HTMLElement;
	private entries: ContextEntry[] = [];
	private onChangeCallback: (entries: ContextEntry[]) => void;
	private suggestInstances: ContextInputSuggest[] = [];
	private pastContexts: string[] = [];
	private app: App;

	constructor(app: App, container: HTMLElement, onChange: (entries: ContextEntry[]) => void) {
		this.app = app;
		this.container = container;
		this.onChangeCallback = onChange;
		this.initializeFields();
	}

	private initializeFields(): void {
		// Start with two empty fields
		this.entries = [
			{ context: '', action: 'look-at' },
			{ context: '', action: 'look-at' }
		];
		this.render();
	}

	private createFieldRow(entry: ContextEntry, index: number): HTMLElement {
		const rowContainer = document.createElement('div');
		
		let textComponent: TextComponent;

		new Setting(rowContainer)
			.addText((text) => {
				textComponent = text;
				text.setPlaceholder(`Context ${index + 1}`);
				text.setValue(entry.context);
				text.onChange((value) => {
					this.entries[index].context = value;
					this.onChangeCallback(this.entries);
					
					// Add new field if this is the last field and user started typing
					if (index === this.entries.length - 1 && value.length > 0) {
						this.addNewField();
					}
				});
			})
			.addDropdown((dropdown) => {
				ACTION_OPTIONS.forEach(option => {
					dropdown.addOption(option.value, option.label);
				});
				dropdown.setValue(entry.action);
				dropdown.onChange((value: string) => {
					this.entries[index].action = value as ActionType;
					this.onChangeCallback(this.entries);
				});
			});

		// Create native suggestions for the text input after textComponent is assigned
		const suggestions = new ContextInputSuggest(
			this.app,
			textComponent!.inputEl, 
			this.pastContexts, 
			(selectedValue) => {
				this.entries[index].context = selectedValue;
				textComponent!.setValue(selectedValue);
				this.onChangeCallback(this.entries);
			}
		);
		this.suggestInstances[index] = suggestions;

		return rowContainer;
	}

	private addNewField(): void {
		this.entries.push({ context: '', action: 'look-at' });
		this.render();
	}

	private render(): void {
		// Clean up existing suggest instances
		this.suggestInstances.forEach(instance => instance?.destroy());
		this.suggestInstances = [];
		
		this.container.innerHTML = '';
		
		this.entries.forEach((entry, index) => {
			const fieldRow = this.createFieldRow(entry, index);
			this.container.appendChild(fieldRow);
		});
	}

	getEntries(): ContextEntry[] {
		return this.entries.filter(entry => entry.context.trim().length > 0);
	}

	hasValidEntries(): boolean {
		return this.getEntries().length > 0;
	}

	setPastContexts(contexts: string[]): void {
		this.pastContexts = contexts;
		// Update all existing suggest instances
		this.suggestInstances.forEach(instance => {
			if (instance) {
				instance.updateSuggestions(contexts);
			}
		});
	}

	reset(): void {
		this.entries = [
			{ context: '', action: 'look-at' },
			{ context: '', action: 'look-at' }
		];
		this.render();
	}

	destroy(): void {
		this.suggestInstances.forEach(instance => instance?.destroy());
		this.suggestInstances = [];
	}
}

