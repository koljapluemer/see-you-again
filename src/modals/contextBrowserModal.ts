import type { App} from 'obsidian';
import { Modal, Notice } from 'obsidian';

import { NoteService } from '../noteService';
import type { SeeYouAgainPlugin } from '../types';
import { ContextNoteViewerModal } from './contextNoteViewerModal';
import { FuzzySearch } from '../utils/fuzzySearch';
import { ContextUtils } from '../utils/contextUtils';

export class ContextBrowserModal extends Modal {
	private plugin: SeeYouAgainPlugin;
	private noteService: NoteService;
	private allContexts: string[] = [];
	private filteredContexts: string[] = [];
	private currentPage = 0;
	private itemsPerPage = 10;
	private searchInput: HTMLInputElement | null = null;
	private contextList: HTMLElement | null = null;
	private paginationControls: HTMLElement | null = null;

	constructor(app: App, plugin: SeeYouAgainPlugin) {
		super(app);
		this.plugin = plugin;
		this.noteService = new NoteService(app);
	}

	async onOpen(): Promise<void> {
		// Add our namespace class to the modal
		this.containerEl.addClass('see-you-again-modal');
		
		// Check if we should resume from a previous context/note
		const lastContextNote = this.plugin.stateManager.get('lastContextNote');
		const lastContext = this.plugin.stateManager.get('lastContext');
		
		if (lastContext && lastContextNote) {
			// Skip the browser and go directly to the note viewer
			this.close();
			
			const hydratedContext = ContextUtils.hydrateContextKey(lastContext);
			const noteViewerModal = new ContextNoteViewerModal(this.app, this.plugin, hydratedContext, lastContext);
			noteViewerModal.open();
			return;
		}
		
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
		header.className = 'context-browser-header';
		
		const title = header.createEl('h2', { text: 'Browse Contexts' });
		title.className = 'context-browser-title';

		// Search bar
		this.searchInput = header.createEl('input', { type: 'text', placeholder: 'Search contexts...' });
		this.searchInput.className = 'context-browser-search';

		this.searchInput.addEventListener('input', () => this.handleSearch());

		// Context list container
		this.contextList = contentEl.createEl('div');
		this.contextList.className = 'context-browser-list';

		// Pagination controls
		this.paginationControls = contentEl.createEl('div');
		this.paginationControls.className = 'context-browser-pagination';

		this.updateDisplay();
	}

	private handleSearch(): void {
		if (!this.searchInput) {return;}

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
		return FuzzySearch.filterStrings(this.allContexts, query);
	}

	private updateDisplay(): void {
		this.renderContextList();
		this.renderPaginationControls();
	}

	private renderContextList(): void {
		if (!this.contextList) {return;}

		this.contextList.innerHTML = '';

		if (this.filteredContexts.length === 0) {
			const emptyMessage = this.contextList.createEl('div', { text: 'No contexts found' });
			emptyMessage.className = 'context-browser-empty';
			return;
		}

		const startIndex = this.currentPage * this.itemsPerPage;
		const endIndex = Math.min(startIndex + this.itemsPerPage, this.filteredContexts.length);
		const pageContexts = this.filteredContexts.slice(startIndex, endIndex);

		pageContexts.forEach(context => {
			const contextItem = this.contextList!.createEl('div');
			contextItem.className = 'context-browser-item';

			contextItem.textContent = context;

			contextItem.addEventListener('click', () => {
				this.selectContext(context);
			});
		});
	}

	private renderPaginationControls(): void {
		if (!this.paginationControls) {return;}

		this.paginationControls.innerHTML = '';

		const totalPages = Math.ceil(this.filteredContexts.length / this.itemsPerPage);

		// Previous button
		const prevButton = this.paginationControls.createEl('button', { text: 'Previous' });
		prevButton.className = 'context-browser-pagination-button';
		if (this.currentPage === 0) {
			prevButton.classList.add('disabled');
		}
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
		pageInfo.className = 'context-browser-pagination-info';

		// Next button
		const nextButton = this.paginationControls.createEl('button', { text: 'Next' });
		nextButton.className = 'context-browser-pagination-button';
		if (this.currentPage >= totalPages - 1) {
			nextButton.classList.add('disabled');
		}
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
		const sanitizedContext = ContextUtils.dehydrateContext(hydratedContext);

		// Close this modal and open the note viewer
		this.close();
		
		// Check if we should resume from a previous note
		this.plugin.stateManager.get('lastContextNote');
		const lastContext = this.plugin.stateManager.get('lastContext');
		
		const noteViewerModal = new ContextNoteViewerModal(this.app, this.plugin, hydratedContext, sanitizedContext);
		
		// If the user is selecting the same context they were viewing before, the modal will resume from that note
		// Otherwise, clear the stored state so they start fresh
		if (lastContext !== sanitizedContext) {
			this.plugin.stateManager.clearNavigationState();
		}
		
		noteViewerModal.open();
	}
}
