import { App, Modal, Notice, Plugin } from 'obsidian';
import { NoteService } from './noteService';
import { SeeYouAgainSettings } from './types';
import { ContextNoteViewerModal } from './contextNoteViewerModal';

export class ContextBrowserModal extends Modal {
	private plugin: Plugin & { settings: SeeYouAgainSettings; saveSettings(): Promise<void> };
	private noteService: NoteService;
	private allContexts: string[] = [];
	private filteredContexts: string[] = [];
	private currentPage: number = 0;
	private itemsPerPage: number = 10;
	private searchInput: HTMLInputElement | null = null;
	private contextList: HTMLElement | null = null;
	private paginationControls: HTMLElement | null = null;

	constructor(app: App, plugin: Plugin & { settings: SeeYouAgainSettings; saveSettings(): Promise<void> }) {
		super(app);
		this.plugin = plugin;
		this.noteService = new NoteService(app);
	}

	async onOpen(): Promise<void> {
		await this.loadContexts();
		this.renderModal();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}

	private async loadContexts(): Promise<void> {
		try {
			this.allContexts = await this.noteService.getAllPastContexts();
			this.filteredContexts = [...this.allContexts];
		} catch (error) {
			console.error('Error loading contexts:', error);
			new Notice('Error loading contexts. Please try again.');
			this.allContexts = [];
			this.filteredContexts = [];
		}
	}

	private renderModal(): void {
		const { contentEl } = this;
		contentEl.empty();

		// Header
		const header = contentEl.createEl('div');
		header.style.cssText = 'margin-bottom: 20px; border-bottom: 1px solid var(--background-modifier-border); padding-bottom: 15px;';
		
		const title = header.createEl('h2', { text: 'Browse Contexts' });
		title.style.cssText = 'margin: 0 0 15px 0; color: var(--text-normal);';

		// Search bar
		this.searchInput = header.createEl('input', { type: 'text', placeholder: 'Search contexts...' });
		this.searchInput.style.cssText = `
			width: 100%;
			padding: 8px 12px;
			border: 1px solid var(--background-modifier-border);
			border-radius: 4px;
			background: var(--background-primary);
			font-size: 14px;
		`;

		this.searchInput.addEventListener('input', () => this.handleSearch());

		// Context list container
		this.contextList = contentEl.createEl('div');
		this.contextList.style.cssText = 'margin-bottom: 20px; min-height: 300px;';

		// Pagination controls
		this.paginationControls = contentEl.createEl('div');
		this.paginationControls.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding-top: 15px; border-top: 1px solid var(--background-modifier-border);';

		this.updateDisplay();
	}

	private handleSearch(): void {
		if (!this.searchInput) return;

		const query = this.searchInput.value.toLowerCase().trim();
		
		if (query === '') {
			this.filteredContexts = [...this.allContexts];
		} else {
			this.filteredContexts = this.fuzzyFilterContexts(query);
		}

		this.currentPage = 0;
		this.updateDisplay();
	}

	private fuzzyFilterContexts(query: string): string[] {
		return this.allContexts
			.map(context => ({
				text: context,
				score: this.fuzzyScore(query, context.toLowerCase())
			}))
			.filter(item => item.score > 0)
			.sort((a, b) => b.score - a.score)
			.map(item => item.text);
	}

	private fuzzyScore(query: string, text: string): number {
		if (text.includes(query)) {
			return 100 + (50 - query.length);
		}

		let queryIndex = 0;
		let score = 0;
		
		for (let i = 0; i < text.length && queryIndex < query.length; i++) {
			if (text[i] === query[queryIndex]) {
				queryIndex++;
				score += 10;
				
				if (i === 0 || text[i - 1] === ' ') {
					score += 5;
				}
			}
		}

		return queryIndex === query.length ? score : 0;
	}

	private updateDisplay(): void {
		this.renderContextList();
		this.renderPaginationControls();
	}

	private renderContextList(): void {
		if (!this.contextList) return;

		this.contextList.innerHTML = '';

		if (this.filteredContexts.length === 0) {
			const emptyMessage = this.contextList.createEl('div', { text: 'No contexts found' });
			emptyMessage.style.cssText = 'text-align: center; color: var(--text-muted); font-style: italic; padding: 40px 0;';
			return;
		}

		const startIndex = this.currentPage * this.itemsPerPage;
		const endIndex = Math.min(startIndex + this.itemsPerPage, this.filteredContexts.length);
		const pageContexts = this.filteredContexts.slice(startIndex, endIndex);

		pageContexts.forEach(context => {
			const contextItem = this.contextList!.createEl('div');
			contextItem.style.cssText = `
				padding: 12px 16px;
				border: 1px solid var(--background-modifier-border);
				border-radius: 6px;
				margin-bottom: 8px;
				cursor: pointer;
				transition: all 0.2s ease;
				background: var(--background-secondary);
			`;

			contextItem.textContent = context;

			contextItem.addEventListener('mouseenter', () => {
				contextItem.style.backgroundColor = 'var(--background-modifier-hover)';
				contextItem.style.borderColor = 'var(--interactive-accent)';
			});

			contextItem.addEventListener('mouseleave', () => {
				contextItem.style.backgroundColor = 'var(--background-secondary)';
				contextItem.style.borderColor = 'var(--background-modifier-border)';
			});

			contextItem.addEventListener('click', () => {
				this.selectContext(context);
			});
		});
	}

	private renderPaginationControls(): void {
		if (!this.paginationControls) return;

		this.paginationControls.innerHTML = '';

		const totalPages = Math.ceil(this.filteredContexts.length / this.itemsPerPage);

		// Previous button
		const prevButton = this.paginationControls.createEl('button', { text: 'Previous' });
		prevButton.style.cssText = `
			padding: 6px 12px;
			border: 1px solid var(--background-modifier-border);
			border-radius: 4px;
			background: var(--background-secondary);
			cursor: pointer;
			opacity: ${this.currentPage > 0 ? '1' : '0.5'};
		`;
		prevButton.disabled = this.currentPage === 0;
		prevButton.addEventListener('click', () => {
			if (this.currentPage > 0) {
				this.currentPage--;
				this.updateDisplay();
			}
		});

		// Page info
		const pageInfo = this.paginationControls.createEl('span');
		pageInfo.textContent = `Page ${this.currentPage + 1} of ${totalPages} (${this.filteredContexts.length} contexts)`;
		pageInfo.style.cssText = 'color: var(--text-muted); font-size: 14px;';

		// Next button
		const nextButton = this.paginationControls.createEl('button', { text: 'Next' });
		nextButton.style.cssText = `
			padding: 6px 12px;
			border: 1px solid var(--background-modifier-border);
			border-radius: 4px;
			background: var(--background-secondary);
			cursor: pointer;
			opacity: ${this.currentPage < totalPages - 1 ? '1' : '0.5'};
		`;
		nextButton.disabled = this.currentPage >= totalPages - 1;
		nextButton.addEventListener('click', () => {
			if (this.currentPage < totalPages - 1) {
				this.currentPage++;
				this.updateDisplay();
			}
		});
	}

	private selectContext(hydratedContext: string): void {
		// Convert back to sanitized format for searching
		const sanitizedContext = hydratedContext
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			|| 'context';

		// Close this modal and open the note viewer
		this.close();
		
		const noteViewerModal = new ContextNoteViewerModal(this.app, this.plugin, hydratedContext, sanitizedContext);
		noteViewerModal.open();
	}
}
