import { App, TFile, Notice, Plugin, MarkdownView, TextComponent, DropdownComponent, ButtonComponent } from 'obsidian';
import { NoteService } from '../noteService';
import { SeeYouAgainSettings, ContextEntry, ActionType, ACTION_OPTIONS } from '../types';
import { ContextUtils } from '../utils/contextUtils';
import { ContextInputSuggest } from './contextSuggest';

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
	private contextSuggest: ContextInputSuggest | null = null;

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
		
		// Make sure the container has relative positioning
		this.container.style.position = 'relative';
		this.container.appendChild(this.toolbarElement);
	}

	private render(): void {
		// Clean up existing suggestion instance
		if (this.contextSuggest) {
			this.contextSuggest.destroy();
			this.contextSuggest = null;
		}
		
		this.toolbarElement.innerHTML = '';
		
		if (!this.isExpanded) {
			this.renderCollapsed();
		} else {
			this.renderExpanded();
		}
	}

	private renderCollapsed(): void {
		const collapsedContent = document.createElement('div');
		collapsedContent.className = 'collapsed-content';

		// Context count and toggle
		const leftSection = document.createElement('div');
		leftSection.className = 'left-section';

		const contextCount = Object.keys(this.existingContexts).length;
		const countText = leftSection.createEl('span', { 
			text: `${contextCount} context${contextCount !== 1 ? 's' : ''}` 
		});
		countText.className = 'context-count';

		const expandButton = leftSection.createEl('button', { text: '▲' });
		expandButton.className = 'expand-button';
		expandButton.addEventListener('click', () => this.toggleExpanded());

		// Quick add button using ButtonComponent
		const addButtonContainer = document.createElement('div');
		const addButtonComponent = new ButtonComponent(addButtonContainer);
		addButtonComponent.setButtonText('+ Add Context');
		addButtonComponent.onClick(() => this.toggleQuickAdd());

		collapsedContent.appendChild(leftSection);
		collapsedContent.appendChild(addButtonContainer);
		this.toolbarElement.appendChild(collapsedContent);
	}

	private renderExpanded(): void {
		const expandedContent = document.createElement('div');

		// Header with collapse button
		const header = expandedContent.createEl('div');
		header.className = 'expanded-header';

		const title = header.createEl('span', { text: 'Contexts' });
		title.className = 'title';

		const collapseButton = header.createEl('button', { text: '▼' });
		collapseButton.className = 'collapse-button';
		collapseButton.addEventListener('click', () => this.toggleExpanded());

		// Existing contexts
		const contextsContainer = expandedContent.createEl('div');
		contextsContainer.className = 'contexts-container';

		if (Object.keys(this.existingContexts).length === 0) {
			const emptyState = contextsContainer.createEl('div', { text: 'No contexts yet' });
			emptyState.className = 'empty-state';
		} else {
			this.renderContextPills(contextsContainer);
		}

		// Quick add section
		if (this.isQuickAddMode) {
			this.renderQuickAddForm(expandedContent);
		} else {
			const addButtonContainer = expandedContent.createEl('div');
			addButtonContainer.className = 'add-button-expanded';
			const addButtonComponent = new ButtonComponent(addButtonContainer);
			addButtonComponent.setButtonText('+ Add Context');
			addButtonComponent.onClick(() => this.toggleQuickAdd());
		}

		this.toolbarElement.appendChild(expandedContent);
	}

	private renderContextPills(container: HTMLElement): void {
		const pillsContainer = container.createEl('div');
		pillsContainer.className = 'pills-container';

		Object.entries(this.existingContexts).forEach(([sanitizedContext, action]) => {
			const hydratedContext = ContextUtils.hydrateContextKey(sanitizedContext);
			const actionLabel = ACTION_OPTIONS.find(opt => opt.value === action)?.label || action;

			const pill = pillsContainer.createEl('div');
			pill.className = 'context-pill';

			const contextText = pill.createEl('span', { text: hydratedContext });
			contextText.className = 'context-text';

			const actionBadge = pill.createEl('span', { text: actionLabel });
			actionBadge.className = 'action-badge';

			const removeButton = pill.createEl('button', { text: '×' });
			removeButton.className = 'remove-button';
			removeButton.addEventListener('click', () => this.removeContext(sanitizedContext));
		});
	}

	private renderQuickAddForm(container: HTMLElement): void {
		const form = container.createEl('div');
		form.className = 'quick-add-form';

		const inputRow = form.createEl('div');
		inputRow.className = 'input-row';

		// Context input with autocomplete
		const inputContainer = inputRow.createEl('div');
		inputContainer.className = 'input-container';
		inputContainer.style.position = 'relative'; // For autocomplete positioning

		let textComponent: TextComponent;
		let dropdownComponent: DropdownComponent;

		// Use TextComponent for context input
		textComponent = new TextComponent(inputContainer);
		textComponent.setPlaceholder('Context...');

		// Use DropdownComponent for action selection  
		dropdownComponent = new DropdownComponent(inputRow);
		ACTION_OPTIONS.forEach(option => {
			dropdownComponent.addOption(option.value, option.label);
		});

		// Buttons using ButtonComponent
		const buttonRow = form.createEl('div');
		buttonRow.className = 'button-row';

		const cancelButtonComponent = new ButtonComponent(buttonRow);
		cancelButtonComponent.setButtonText('Cancel');
		cancelButtonComponent.onClick(() => this.toggleQuickAdd());

		const saveButtonComponent = new ButtonComponent(buttonRow);
		saveButtonComponent.setButtonText('Add');
		saveButtonComponent.onClick(() => {
			this.addContext(textComponent.getValue(), dropdownComponent.getValue() as ActionType);
		});

		// Add native suggestions to text input
		this.contextSuggest = new ContextInputSuggest(
			this.app,
			textComponent.inputEl, 
			this.pastContexts, 
			(selectedValue) => {
				textComponent.setValue(selectedValue);
			}
		);

		// Focus the input
		setTimeout(() => textComponent.inputEl.focus(), 50);
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
		// Clean up suggestion instance
		if (this.contextSuggest) {
			this.contextSuggest.destroy();
			this.contextSuggest = null;
		}
		
		if (this.toolbarElement && this.toolbarElement.parentElement) {
			this.toolbarElement.parentElement.removeChild(this.toolbarElement);
		}
	}
}
