import { App, TFile, Notice, Plugin, MarkdownView } from 'obsidian';
import { NoteService } from '../noteService';
import { SeeYouAgainSettings, ContextEntry, ActionType, ACTION_OPTIONS } from '../types';
import { ContextUtils } from '../utils/contextUtils';
import { FuzzySearch } from '../utils/fuzzySearch';

export class ContextToolbar {
	private app: App;
	private plugin: Plugin & { settings: SeeYouAgainSettings; saveSettings(): Promise<void> };
	private noteService: NoteService;
	private file: TFile;
	private container: HTMLElement;
	private toolbarElement: HTMLElement;
	private isExpanded: boolean = false;
	private isQuickAddMode: boolean = false;
	private existingContexts: { [key: string]: ActionType } = {};
	private pastContexts: string[] = [];

	constructor(
		app: App,
		plugin: Plugin & { settings: SeeYouAgainSettings; saveSettings(): Promise<void> },
		file: TFile,
		container: HTMLElement
	) {
		this.app = app;
		this.plugin = plugin;
		this.noteService = new NoteService(app);
		this.file = file;
		this.container = container;
		this.init();
	}

	private async init(): Promise<void> {
		await this.loadContexts();
		await this.loadPastContexts();
		this.createToolbar();
		this.render();
	}

	private async loadContexts(): Promise<void> {
		try {
			const fileCache = this.app.metadataCache.getFileCache(this.file);
			const frontmatter = fileCache?.frontmatter;
			
			if (frontmatter && frontmatter['see-you-again']) {
				const seeYouAgain = frontmatter['see-you-again'];
				if (typeof seeYouAgain === 'object' && !Array.isArray(seeYouAgain)) {
					this.existingContexts = { ...seeYouAgain };
				}
			}
		} catch (error) {
			console.error('Error loading contexts for toolbar:', error);
		}
	}

	private async loadPastContexts(): Promise<void> {
		try {
			this.pastContexts = await this.noteService.getAllPastContexts();
		} catch (error) {
			console.error('Error loading past contexts for toolbar:', error);
		}
	}

	private createToolbar(): void {
		this.toolbarElement = document.createElement('div');
		this.toolbarElement.className = 'see-you-again-toolbar';
		this.toolbarElement.style.cssText = `
			position: absolute;
			bottom: 0;
			left: 0;
			right: 0;
			background: var(--background-primary);
			border-top: 1px solid var(--background-modifier-border);
			padding: 8px 12px;
			z-index: 100;
			transition: all 0.2s ease;
			box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
		`;
		
		// Make sure the container has relative positioning
		this.container.style.position = 'relative';
		this.container.appendChild(this.toolbarElement);
	}

	private render(): void {
		this.toolbarElement.innerHTML = '';
		
		if (!this.isExpanded) {
			this.renderCollapsed();
		} else {
			this.renderExpanded();
		}
	}

	private renderCollapsed(): void {
		const collapsedContent = document.createElement('div');
		collapsedContent.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';

		// Context count and toggle
		const leftSection = document.createElement('div');
		leftSection.style.cssText = 'display: flex; align-items: center; gap: 8px;';

		const contextCount = Object.keys(this.existingContexts).length;
		const countText = leftSection.createEl('span', { 
			text: `${contextCount} context${contextCount !== 1 ? 's' : ''}` 
		});
		countText.style.cssText = 'font-size: 12px; color: var(--text-muted);';

		const expandButton = leftSection.createEl('button', { text: '▲' });
		expandButton.style.cssText = `
			padding: 2px 6px;
			border: none;
			background: none;
			color: var(--text-muted);
			cursor: pointer;
			font-size: 10px;
			transition: color 0.2s ease;
		`;
		expandButton.addEventListener('click', () => this.toggleExpanded());
		expandButton.addEventListener('mouseenter', () => {
			expandButton.style.color = 'var(--text-normal)';
		});
		expandButton.addEventListener('mouseleave', () => {
			expandButton.style.color = 'var(--text-muted)';
		});

		// Quick add button
		const addButton = document.createElement('button');
		addButton.textContent = '+ Add Context';
		addButton.style.cssText = `
			padding: 4px 8px;
			border: 1px solid var(--interactive-accent);
			border-radius: 3px;
			background: var(--background-primary);
			color: var(--interactive-accent);
			cursor: pointer;
			font-size: 11px;
			transition: all 0.2s ease;
		`;
		addButton.addEventListener('click', () => this.toggleQuickAdd());
		addButton.addEventListener('mouseenter', () => {
			addButton.style.backgroundColor = 'var(--interactive-accent)';
			addButton.style.color = 'var(--text-on-accent)';
		});
		addButton.addEventListener('mouseleave', () => {
			addButton.style.backgroundColor = 'var(--background-primary)';
			addButton.style.color = 'var(--interactive-accent)';
		});

		collapsedContent.appendChild(leftSection);
		collapsedContent.appendChild(addButton);
		this.toolbarElement.appendChild(collapsedContent);
	}

	private renderExpanded(): void {
		const expandedContent = document.createElement('div');

		// Header with collapse button
		const header = expandedContent.createEl('div');
		header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;';

		const title = header.createEl('span', { text: 'Contexts' });
		title.style.cssText = 'font-weight: 500; font-size: 13px; color: var(--text-normal);';

		const collapseButton = header.createEl('button', { text: '▼' });
		collapseButton.style.cssText = `
			padding: 2px 6px;
			border: none;
			background: none;
			color: var(--text-muted);
			cursor: pointer;
			font-size: 10px;
		`;
		collapseButton.addEventListener('click', () => this.toggleExpanded());

		// Existing contexts
		const contextsContainer = expandedContent.createEl('div');
		contextsContainer.style.cssText = 'margin-bottom: 8px;';

		if (Object.keys(this.existingContexts).length === 0) {
			const emptyState = contextsContainer.createEl('div', { text: 'No contexts yet' });
			emptyState.style.cssText = 'color: var(--text-muted); font-style: italic; font-size: 12px; padding: 4px 0;';
		} else {
			this.renderContextPills(contextsContainer);
		}

		// Quick add section
		if (this.isQuickAddMode) {
			this.renderQuickAddForm(expandedContent);
		} else {
			const addButton = expandedContent.createEl('button', { text: '+ Add Context' });
			addButton.style.cssText = `
				padding: 6px 12px;
				border: 1px solid var(--interactive-accent);
				border-radius: 4px;
				background: var(--background-primary);
				color: var(--interactive-accent);
				cursor: pointer;
				font-size: 12px;
				width: 100%;
			`;
			addButton.addEventListener('click', () => this.toggleQuickAdd());
		}

		this.toolbarElement.appendChild(expandedContent);
	}

	private renderContextPills(container: HTMLElement): void {
		const pillsContainer = container.createEl('div');
		pillsContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 4px;';

		Object.entries(this.existingContexts).forEach(([sanitizedContext, action]) => {
			const hydratedContext = ContextUtils.hydrateContextKey(sanitizedContext);
			const actionLabel = ACTION_OPTIONS.find(opt => opt.value === action)?.label || action;

			const pill = pillsContainer.createEl('div');
			pill.style.cssText = `
				display: flex;
				align-items: center;
				gap: 4px;
				padding: 2px 6px;
				background: var(--background-secondary);
				border: 1px solid var(--background-modifier-border);
				border-radius: 12px;
				font-size: 11px;
			`;

			const contextText = pill.createEl('span', { text: hydratedContext });
			contextText.style.cssText = 'color: var(--text-normal);';

			const actionBadge = pill.createEl('span', { text: actionLabel });
			actionBadge.style.cssText = `
				background: var(--interactive-accent);
				color: var(--text-on-accent);
				padding: 1px 4px;
				border-radius: 6px;
				font-size: 9px;
				font-weight: 500;
			`;

			const removeButton = pill.createEl('button', { text: '×' });
			removeButton.style.cssText = `
				border: none;
				background: none;
				color: var(--text-muted);
				cursor: pointer;
				font-size: 12px;
				padding: 0;
				margin-left: 2px;
				line-height: 1;
			`;
			removeButton.addEventListener('click', () => this.removeContext(sanitizedContext));
		});
	}

	private renderQuickAddForm(container: HTMLElement): void {
		const form = container.createEl('div');
		form.style.cssText = 'border: 1px solid var(--background-modifier-border); border-radius: 4px; padding: 8px; background: var(--background-secondary);';

		const inputRow = form.createEl('div');
		inputRow.style.cssText = 'display: flex; gap: 6px; margin-bottom: 6px;';

		// Context input with autocomplete
		const inputContainer = inputRow.createEl('div');
		inputContainer.style.cssText = 'flex: 1; position: relative;';

		const contextInput = inputContainer.createEl('input') as HTMLInputElement;
		contextInput.type = 'text';
		contextInput.placeholder = 'Context...';
		contextInput.style.cssText = `
			width: 100%;
			padding: 4px 6px;
			border: 1px solid var(--background-modifier-border);
			border-radius: 3px;
			background: var(--background-primary);
			font-size: 12px;
		`;

		// Action dropdown
		const actionSelect = inputRow.createEl('select') as HTMLSelectElement;
		actionSelect.style.cssText = `
			padding: 4px 6px;
			border: 1px solid var(--background-modifier-border);
			border-radius: 3px;
			background: var(--background-primary);
			font-size: 12px;
			min-width: 80px;
		`;

		ACTION_OPTIONS.forEach(option => {
			const optionEl = actionSelect.createEl('option');
			optionEl.value = option.value;
			optionEl.textContent = option.label;
		});

		// Buttons
		const buttonRow = form.createEl('div');
		buttonRow.style.cssText = 'display: flex; gap: 6px; justify-content: flex-end;';

		const cancelButton = buttonRow.createEl('button', { text: 'Cancel' });
		cancelButton.style.cssText = `
			padding: 4px 8px;
			border: 1px solid var(--background-modifier-border);
			border-radius: 3px;
			background: var(--background-secondary);
			color: var(--text-normal);
			cursor: pointer;
			font-size: 11px;
		`;
		cancelButton.addEventListener('click', () => this.toggleQuickAdd());

		const saveButton = buttonRow.createEl('button', { text: 'Add' });
		saveButton.style.cssText = `
			padding: 4px 8px;
			border: 1px solid var(--interactive-accent);
			border-radius: 3px;
			background: var(--interactive-accent);
			color: var(--text-on-accent);
			cursor: pointer;
			font-size: 11px;
		`;
		saveButton.addEventListener('click', () => {
			this.addContext(contextInput.value, actionSelect.value as ActionType);
		});

		// Add autocomplete to context input
		this.addAutocomplete(contextInput);

		// Focus the input
		setTimeout(() => contextInput.focus(), 50);
	}

	private addAutocomplete(input: HTMLInputElement): void {
		const dropdown = document.createElement('div');
		dropdown.style.cssText = `
			position: absolute;
			top: 100%;
			left: 0;
			right: 0;
			background: var(--background-primary);
			border: 1px solid var(--background-modifier-border);
			border-radius: 4px;
			max-height: 120px;
			overflow-y: auto;
			z-index: 1000;
			display: none;
			box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
		`;

		input.parentElement!.appendChild(dropdown);

		input.addEventListener('input', () => {
			const query = input.value.toLowerCase().trim();
			
			if (query.length === 0) {
				dropdown.style.display = 'none';
				return;
			}

			const filtered = FuzzySearch.filterStrings(this.pastContexts, query, 5);
			
			if (filtered.length > 0) {
				dropdown.innerHTML = '';
				dropdown.style.display = 'block';

				filtered.forEach(suggestion => {
					const item = dropdown.createEl('div', { text: suggestion });
					item.style.cssText = `
						padding: 6px 8px;
						cursor: pointer;
						border-bottom: 1px solid var(--background-modifier-border-hover);
						font-size: 12px;
					`;

					item.addEventListener('mouseenter', () => {
						item.style.backgroundColor = 'var(--background-modifier-hover)';
					});

					item.addEventListener('mouseleave', () => {
						item.style.backgroundColor = 'transparent';
					});

					item.addEventListener('click', () => {
						input.value = suggestion;
						dropdown.style.display = 'none';
					});
				});
			} else {
				dropdown.style.display = 'none';
			}
		});

		input.addEventListener('blur', () => {
			setTimeout(() => dropdown.style.display = 'none', 150);
		});
	}

	private toggleExpanded(): void {
		this.isExpanded = !this.isExpanded;
		this.render();
	}

	private toggleQuickAdd(): void {
		if (!this.isExpanded) {
			this.isExpanded = true;
		}
		this.isQuickAddMode = !this.isQuickAddMode;
		this.render();
	}

	private async addContext(context: string, action: ActionType): Promise<void> {
		if (!context.trim()) {
			new Notice('Please enter a context');
			return;
		}

		if (!ContextUtils.validateContext(context)) {
			new Notice('Context is too long or invalid');
			return;
		}

		try {
			const sanitizedKey = ContextUtils.sanitizeContextKey(context);
			this.existingContexts[sanitizedKey] = action;

			await this.saveContexts();
			new Notice(`Added context: ${context}`);
			
			this.isQuickAddMode = false;
			this.render();
		} catch (error) {
			console.error('Error adding context:', error);
			new Notice('Error adding context. Please try again.');
		}
	}

	private async removeContext(sanitizedContext: string): Promise<void> {
		try {
			delete this.existingContexts[sanitizedContext];
			await this.saveContexts();
			
			const hydratedContext = ContextUtils.hydrateContextKey(sanitizedContext);
			new Notice(`Removed context: ${hydratedContext}`);
			
			this.render();
		} catch (error) {
			console.error('Error removing context:', error);
			new Notice('Error removing context. Please try again.');
		}
	}

	private async saveContexts(): Promise<void> {
		await this.noteService.saveMetadata(this.file, this.existingContexts);
	}

	public async refresh(): Promise<void> {
		await this.loadContexts();
		this.render();
	}

	public destroy(): void {
		if (this.toolbarElement && this.toolbarElement.parentElement) {
			this.toolbarElement.parentElement.removeChild(this.toolbarElement);
		}
	}
}
