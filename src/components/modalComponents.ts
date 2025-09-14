import type { App } from 'obsidian';
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

		new Setting(rowContainer)
			.addText((text) => {
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

				// Create native suggestions for the text input
				const suggestions = new ContextInputSuggest(
					this.app,
					text.inputEl, 
					this.pastContexts, 
					(selectedValue) => {
						this.entries[index].context = selectedValue;
						text.setValue(selectedValue);
						this.onChangeCallback(this.entries);
					}
				);
				this.suggestInstances[index] = suggestions;
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

		// Create native suggestions for the text input (moved inside addText callback)
		// This is now handled inside the addText callback above

		return rowContainer;
	}

	private addNewField(): void {
		const newEntry: ContextEntry = { context: '', action: 'look-at' };
		this.entries.push(newEntry);
		this.appendField(newEntry, this.entries.length - 1);
	}

	private appendField(entry: ContextEntry, index: number): void {
		const fieldRow = this.createFieldRow(entry, index);
		this.container.appendChild(fieldRow);
	}

	private render(): void {
		// Clean up existing suggest instances
		this.suggestInstances.forEach(instance => instance?.destroy());
		this.suggestInstances = [];
		
		this.container.empty();
		
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
			if (instance !== null && instance !== undefined) {
				instance.updateSuggestions(contexts);
			}
		});
	}

	addEntry(context: string, action: ActionType): void {
		// Find empty entry or add new one
		const emptyIndex = this.entries.findIndex(entry => entry.context.trim() === '');
		if (emptyIndex >= 0) {
			// Update existing empty entry - need full re-render to update the field values
			this.entries[emptyIndex] = { context, action };
			this.render();
		} else {
			// Add new entry - can just append
			const newEntry: ContextEntry = { context, action };
			this.entries.push(newEntry);
			this.appendField(newEntry, this.entries.length - 1);
		}
	}

	setEntries(entries: ContextEntry[]): void {
		this.entries = [...entries];
		// Ensure we always have at least one empty field at the end
		if (this.entries.length === 0 || this.entries[this.entries.length - 1].context.trim() !== '') {
			this.entries.push({ context: '', action: 'look-at' });
		}
		this.render();
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

