import { ContextEntry, ActionType, ACTION_OPTIONS } from './types';

class FuzzyAutocomplete {
	private container: HTMLElement;
	private input: HTMLInputElement;
	private dropdown: HTMLElement;
	private suggestions: string[] = [];
	private filteredSuggestions: string[] = [];
	private selectedIndex: number = -1;
	private onSelect: (value: string) => void;

	constructor(input: HTMLInputElement, suggestions: string[], onSelect: (value: string) => void) {
		this.input = input;
		this.suggestions = suggestions;
		this.onSelect = onSelect;
		this.container = input.parentElement!;
		this.createDropdown();
		this.bindEvents();
	}

	private createDropdown(): void {
		this.dropdown = document.createElement('div');
		this.dropdown.style.cssText = `
			position: absolute;
			top: 100%;
			left: 0;
			right: 0;
			background: var(--background-primary);
			border: 1px solid var(--background-modifier-border);
			border-radius: 4px;
			max-height: 200px;
			overflow-y: auto;
			z-index: 1000;
			display: none;
			box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
		`;
		
		// Ensure parent has relative positioning
		this.container.style.position = 'relative';
		this.container.appendChild(this.dropdown);
	}

	private bindEvents(): void {
		this.input.addEventListener('input', () => this.handleInput());
		this.input.addEventListener('keydown', (e) => this.handleKeydown(e));
		this.input.addEventListener('blur', () => {
			// Delay hiding to allow click events
			setTimeout(() => this.hideDropdown(), 150);
		});
		this.input.addEventListener('focus', () => this.handleInput());
	}

	private handleInput(): void {
		const query = this.input.value.toLowerCase().trim();
		
		if (query.length === 0) {
			this.hideDropdown();
			return;
		}

		this.filteredSuggestions = this.fuzzyFilter(query);
		this.selectedIndex = -1;
		
		if (this.filteredSuggestions.length > 0) {
			this.showDropdown();
		} else {
			this.hideDropdown();
		}
	}

	private fuzzyFilter(query: string): string[] {
		return this.suggestions
			.map(suggestion => ({
				text: suggestion,
				score: this.fuzzyScore(query, suggestion.toLowerCase())
			}))
			.filter(item => item.score > 0)
			.sort((a, b) => b.score - a.score)
			.slice(0, 8) // Limit to 8 suggestions
			.map(item => item.text);
	}

	private fuzzyScore(query: string, text: string): number {
		if (text.includes(query)) {
			// Exact substring match gets high score
			return 100 + (50 - query.length);
		}

		// Fuzzy matching: check if all query characters appear in order
		let queryIndex = 0;
		let score = 0;
		
		for (let i = 0; i < text.length && queryIndex < query.length; i++) {
			if (text[i] === query[queryIndex]) {
				queryIndex++;
				score += 10;
				
				// Bonus for word boundaries
				if (i === 0 || text[i - 1] === ' ') {
					score += 5;
				}
			}
		}

		return queryIndex === query.length ? score : 0;
	}

	private showDropdown(): void {
		this.dropdown.innerHTML = '';
		this.dropdown.style.display = 'block';

		this.filteredSuggestions.forEach((suggestion, index) => {
			const item = document.createElement('div');
			item.textContent = suggestion;
			item.style.cssText = `
				padding: 8px 12px;
				cursor: pointer;
				border-bottom: 1px solid var(--background-modifier-border-hover);
				transition: background-color 0.1s ease;
			`;

			item.addEventListener('mouseenter', () => {
				this.selectedIndex = index;
				this.updateSelection();
			});

			item.addEventListener('click', () => {
				this.selectItem(suggestion);
			});

			this.dropdown.appendChild(item);
		});

		this.updateSelection();
	}

	private hideDropdown(): void {
		this.dropdown.style.display = 'none';
		this.selectedIndex = -1;
	}

	private handleKeydown(e: KeyboardEvent): void {
		if (this.dropdown.style.display === 'none') return;

		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredSuggestions.length - 1);
				this.updateSelection();
				break;
			case 'ArrowUp':
				e.preventDefault();
				this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
				this.updateSelection();
				break;
			case 'Enter':
				e.preventDefault();
				if (this.selectedIndex >= 0) {
					this.selectItem(this.filteredSuggestions[this.selectedIndex]);
				}
				break;
			case 'Escape':
				e.preventDefault();
				this.hideDropdown();
				break;
		}
	}

	private updateSelection(): void {
		const items = this.dropdown.children;
		Array.from(items).forEach((item, index) => {
			const element = item as HTMLElement;
			if (index === this.selectedIndex) {
				element.style.backgroundColor = 'var(--background-modifier-hover)';
			} else {
				element.style.backgroundColor = 'transparent';
			}
		});
	}

	private selectItem(value: string): void {
		this.input.value = value;
		this.hideDropdown();
		this.onSelect(value);
		
		// Trigger input event to update the form
		this.input.dispatchEvent(new Event('input', { bubbles: true }));
	}

	updateSuggestions(newSuggestions: string[]): void {
		this.suggestions = newSuggestions;
		if (this.dropdown.style.display === 'block') {
			this.handleInput(); // Refresh dropdown if open
		}
	}

	destroy(): void {
		if (this.dropdown.parentElement) {
			this.dropdown.parentElement.removeChild(this.dropdown);
		}
	}
}

export class ContextFieldManager {
	private container: HTMLElement;
	private entries: ContextEntry[] = [];
	private onChangeCallback: (entries: ContextEntry[]) => void;
	private autocompleteInstances: FuzzyAutocomplete[] = [];
	private pastContexts: string[] = [];

	constructor(container: HTMLElement, onChange: (entries: ContextEntry[]) => void) {
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
		const row = document.createElement('div');
		row.classList.add('context-field-row');
		row.style.cssText = 'display: flex; gap: 8px; margin-bottom: 8px; align-items: flex-start;';

		// Context input container (for autocomplete positioning)
		const inputContainer = document.createElement('div');
		inputContainer.style.cssText = 'flex: 1; position: relative;';

		// Context input field
		const contextInput = document.createElement('input');
		contextInput.type = 'text';
		contextInput.placeholder = `Context ${index + 1}`;
		contextInput.value = entry.context;
		contextInput.style.cssText = 'width: 100%; padding: 6px; border: 1px solid var(--background-modifier-border); border-radius: 4px; background: var(--background-primary);';
		
		contextInput.addEventListener('input', (e) => {
			const target = e.target as HTMLInputElement;
			this.entries[index].context = target.value;
			this.onChangeCallback(this.entries);
			
			// Add new field if this is the last field and user started typing
			if (index === this.entries.length - 1 && target.value.length > 0) {
				this.addNewField();
			}
		});

		inputContainer.appendChild(contextInput);

		// Create autocomplete for this input
		const autocomplete = new FuzzyAutocomplete(
			contextInput, 
			this.pastContexts, 
			(selectedValue) => {
				this.entries[index].context = selectedValue;
				this.onChangeCallback(this.entries);
			}
		);
		this.autocompleteInstances[index] = autocomplete;

		// Action dropdown
		const actionSelect = document.createElement('select');
		actionSelect.style.cssText = 'padding: 6px; border: 1px solid var(--background-modifier-border); border-radius: 4px; background: var(--background-primary); min-width: 100px;';
		
		ACTION_OPTIONS.forEach(option => {
			const optionEl = document.createElement('option');
			optionEl.value = option.value;
			optionEl.textContent = option.label;
			optionEl.selected = option.value === entry.action;
			actionSelect.appendChild(optionEl);
		});

		actionSelect.addEventListener('change', (e) => {
			const target = e.target as HTMLSelectElement;
			this.entries[index].action = target.value as ActionType;
			this.onChangeCallback(this.entries);
		});

		row.appendChild(inputContainer);
		row.appendChild(actionSelect);

		return row;
	}

	private addNewField(): void {
		this.entries.push({ context: '', action: 'look-at' });
		this.render();
	}

	private render(): void {
		// Clean up existing autocomplete instances
		this.autocompleteInstances.forEach(instance => instance?.destroy());
		this.autocompleteInstances = [];
		
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
		// Update all existing autocomplete instances
		this.autocompleteInstances.forEach(instance => {
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
		this.autocompleteInstances.forEach(instance => instance?.destroy());
		this.autocompleteInstances = [];
	}
}

export class ModalButtonManager {
	private container: HTMLElement;
	private onSkip: () => void;
	private onExclude: () => void;
	private onNext: () => void;
	private isValidForm: () => boolean;

	constructor(
		container: HTMLElement,
		callbacks: {
			onSkip: () => void;
			onExclude: () => void;
			onNext: () => void;
			isValidForm: () => boolean;
		}
	) {
		this.container = container;
		this.onSkip = callbacks.onSkip;
		this.onExclude = callbacks.onExclude;
		this.onNext = callbacks.onNext;
		this.isValidForm = callbacks.isValidForm;
		this.render();
	}

	private createButton(text: string, onClick: () => void, variant: 'primary' | 'secondary' | 'destructive' = 'secondary'): HTMLButtonElement {
		const button = document.createElement('button');
		button.textContent = text;
		button.style.cssText = `
			padding: 8px 16px;
			border: 1px solid var(--background-modifier-border);
			border-radius: 4px;
			cursor: pointer;
			font-size: 14px;
			margin-right: 8px;
			transition: all 0.2s ease;
		`;

		switch (variant) {
			case 'primary':
				button.style.backgroundColor = 'var(--interactive-accent)';
				button.style.color = 'var(--text-on-accent)';
				break;
			case 'destructive':
				button.style.backgroundColor = 'var(--background-secondary)';
				button.style.color = 'var(--text-error)';
				button.style.border = '1px solid var(--text-error)';
				button.addEventListener('mouseenter', () => {
					button.style.backgroundColor = 'var(--background-modifier-error-hover)';
					button.style.color = 'var(--text-on-accent)';
				});
				button.addEventListener('mouseleave', () => {
					button.style.backgroundColor = 'var(--background-secondary)';
					button.style.color = 'var(--text-error)';
				});
				break;
			default:
				button.style.backgroundColor = 'var(--background-secondary)';
				button.style.color = 'var(--text-normal)';
		}

		button.addEventListener('click', onClick);
		return button;
	}

	private render(): void {
		this.container.style.cssText = 'display: flex; justify-content: space-between; margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--background-modifier-border);';

		const leftButtons = document.createElement('div');
		const rightButtons = document.createElement('div');

		// Left side buttons
		const skipButton = this.createButton('Skip', this.onSkip);
		const excludeButton = this.createButton('Exclude', this.onExclude, 'destructive');
		
		leftButtons.appendChild(skipButton);
		leftButtons.appendChild(excludeButton);

		// Right side buttons
		const saveAndNextButton = this.createButton('Save & Next', this.onNext, 'primary');

		rightButtons.appendChild(saveAndNextButton);

		this.container.appendChild(leftButtons);
		this.container.appendChild(rightButtons);

		// Update button states
		this.updateButtonStates();
	}

	updateButtonStates(): void {
		// Find ONLY the Save & Next button by text content, not position
		const allButtons = Array.from(this.container.querySelectorAll('button'));
		let saveAndNextButton: HTMLButtonElement | null = null;
		
		for (const button of allButtons) {
			if (button.textContent === 'Save & Next') {
				saveAndNextButton = button;
				break;
			}
		}
		
		const isValid = this.isValidForm();
		
		// ONLY touch the Save & Next button, NEVER any other button
		if (saveAndNextButton) {
			saveAndNextButton.disabled = !isValid;
			saveAndNextButton.style.opacity = isValid ? '1' : '0.5';
			saveAndNextButton.style.cursor = isValid ? 'pointer' : 'not-allowed';
		}
	}
}
