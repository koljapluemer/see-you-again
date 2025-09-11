import { App, Modal, TFile, Notice, Plugin, MarkdownRenderer } from 'obsidian';
import { NoteService } from './noteService';
import { ContextFieldManager, ModalButtonManager } from './modalComponents';
import { ContextEntry, SeeYouAgainFrontmatter, SeeYouAgainSettings } from './types';

export class AddContextModal extends Modal {
	private plugin: Plugin & { settings: SeeYouAgainSettings; saveSettings(): Promise<void> };
	private noteService: NoteService;
	private currentNote: TFile | null = null;
	private contextFieldManager: ContextFieldManager | null = null;
	private buttonManager: ModalButtonManager | null = null;

	constructor(app: App, plugin: Plugin & { settings: SeeYouAgainSettings; saveSettings(): Promise<void> }) {
		super(app);
		this.plugin = plugin;
		this.noteService = new NoteService(app);
	}

	async onOpen(): Promise<void> {
		await this.loadRandomNote();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.currentNote = null;
		this.contextFieldManager = null;
		this.buttonManager = null;
	}

	private async loadRandomNote(): Promise<void> {
		try {
			// First, try to load the previously opened note if it exists and is still eligible
			if (this.plugin.settings.currentModalNote) {
				const previousNote = this.app.vault.getAbstractFileByPath(this.plugin.settings.currentModalNote);
				if (previousNote instanceof TFile) {
					const isStillEligible = await this.noteService.isNoteEligible(previousNote);
					if (isStillEligible) {
						this.currentNote = previousNote;
						await this.renderModal();
						return;
					} else {
						// Note is no longer eligible, clear it from settings
						this.plugin.settings.currentModalNote = '';
						await this.plugin.saveSettings();
					}
				} else {
					// Note no longer exists, clear it from settings
					this.plugin.settings.currentModalNote = '';
					await this.plugin.saveSettings();
				}
			}

			// If no previous note or it's not eligible, get a random one
			this.currentNote = await this.noteService.getRandomNote();
			
			if (!this.currentNote) {
				this.showNoNotesMessage();
				return;
			}

			// Save the new current note
			this.plugin.settings.currentModalNote = this.currentNote.path;
			await this.plugin.saveSettings();

			await this.renderModal();
		} catch (error) {
			console.error('Error loading random note:', error);
			new Notice('Error loading note. Please try again.');
		}
	}

	private showNoNotesMessage(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: 'No Notes Available' });
		contentEl.createEl('p', { 
			text: 'All notes in your vault already have "see-you-again" metadata, or there are no notes available.' 
		});
		
		const buttonContainer = contentEl.createEl('div');
		buttonContainer.style.cssText = 'margin-top: 20px; text-align: center;';
		
		const closeButton = buttonContainer.createEl('button', { text: 'Close' });
		closeButton.style.cssText = 'padding: 8px 16px; border: 1px solid var(--background-modifier-border); border-radius: 4px; background: var(--background-secondary); cursor: pointer;';
		closeButton.addEventListener('click', () => this.close());
	}

	private async renderModal(): Promise<void> {
		if (!this.currentNote) return;

		const { contentEl } = this;
		contentEl.empty();

		// Header
		const header = contentEl.createEl('div');
		header.style.cssText = 'margin-bottom: 20px; border-bottom: 1px solid var(--background-modifier-border); padding-bottom: 15px;';
		
		// Header top row with title and jump button
		const headerTop = header.createEl('div');
		headerTop.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;';
		
		const noteTitle = headerTop.createEl('h3', { text: this.currentNote.basename });
		noteTitle.style.cssText = 'margin: 0; color: var(--text-accent); font-weight: normal;';
		
		// Jump to Note button
		const jumpButton = headerTop.createEl('button', { text: 'Jump to Note' });
		jumpButton.style.cssText = `
			padding: 4px 12px;
			border: 1px solid var(--interactive-accent);
			border-radius: 4px;
			background: var(--background-primary);
			color: var(--interactive-accent);
			cursor: pointer;
			font-size: 12px;
			transition: all 0.2s ease;
		`;
		
		jumpButton.addEventListener('mouseenter', () => {
			jumpButton.style.backgroundColor = 'var(--interactive-accent)';
			jumpButton.style.color = 'var(--text-on-accent)';
		});
		
		jumpButton.addEventListener('mouseleave', () => {
			jumpButton.style.backgroundColor = 'var(--background-primary)';
			jumpButton.style.color = 'var(--interactive-accent)';
		});
		
		jumpButton.addEventListener('click', () => this.handleJumpToNote());

		// Note preview
		const previewContainer = contentEl.createEl('div');
		previewContainer.style.cssText = 'margin-bottom: 20px; padding: 12px; background: var(--background-secondary); border-radius: 6px; max-height: 300px; overflow-y: auto; border: 1px solid var(--background-modifier-border);';
		
		try {
			const noteContent = await this.app.vault.read(this.currentNote);
			if (!noteContent || noteContent.trim().length === 0) {
				previewContainer.createEl('div', { 
					text: 'This note is empty',
					cls: 'note-preview-empty'
				});
				previewContainer.style.fontStyle = 'italic';
				previewContainer.style.color = 'var(--text-muted)';
			} else {
				// Render the markdown content
				await this.renderNoteContent(previewContainer, noteContent);
			}
		} catch (error) {
			console.error('Error loading note content:', error);
			previewContainer.createEl('div', { 
				text: 'Could not load note preview',
				cls: 'note-preview-error'
			});
			previewContainer.style.color = 'var(--text-error)';
		}

		// Context fields container
		const fieldsContainer = contentEl.createEl('div');
		fieldsContainer.style.cssText = 'margin-bottom: 20px;';

		// Initialize field manager
		this.contextFieldManager = new ContextFieldManager(fieldsContainer, (entries) => {
			this.buttonManager?.updateButtonStates();
		});

		// Buttons container
		const buttonsContainer = contentEl.createEl('div');
		
		// Initialize button manager
		this.buttonManager = new ModalButtonManager(buttonsContainer, {
			onSkip: () => this.handleSkip(),
			onExclude: () => this.handleExclude(),
			onNext: () => this.handleSaveAndNext(),
			isValidForm: () => this.contextFieldManager?.hasValidEntries() || false
		});
	}

	private async handleSkip(): Promise<void> {
		// Clear the current note from settings so we get a new random one
		this.plugin.settings.currentModalNote = '';
		await this.plugin.saveSettings();
		await this.loadRandomNote();
	}

	private async handleExclude(): Promise<void> {
		if (!this.currentNote) return;

		try {
			await this.noteService.excludeNote(this.currentNote);
			new Notice(`Excluded "${this.currentNote.basename}" from future sessions`);
			
			// Clear the current note from settings and load a new one
			this.plugin.settings.currentModalNote = '';
			await this.plugin.saveSettings();
			await this.loadRandomNote();
		} catch (error) {
			console.error('Error excluding note:', error);
			new Notice('Error excluding note. Please try again.');
		}
	}

	private async handleSave(): Promise<void> {
		if (!this.currentNote || !this.contextFieldManager) return;

		const entries = this.contextFieldManager.getEntries();
		if (entries.length === 0) {
			new Notice('Please add at least one context before saving.');
			return;
		}

		try {
			const metadata: SeeYouAgainFrontmatter = {};
			entries.forEach(entry => {
				const sanitizedKey = this.sanitizeContextKey(entry.context);
				metadata[sanitizedKey] = entry.action;
			});

			await this.noteService.saveMetadata(this.currentNote, metadata);
			new Notice(`Saved contexts for "${this.currentNote.basename}"`);
			
			// Clear the current note from settings and load a new one
			this.plugin.settings.currentModalNote = '';
			await this.plugin.saveSettings();
			await this.loadRandomNote();
		} catch (error) {
			console.error('Error saving note metadata:', error);
			new Notice('Error saving note. Please try again.');
		}
	}

	private async handleSaveAndNext(): Promise<void> {
		await this.handleSave();
	}

	private async handleJumpToNote(): Promise<void> {
		if (!this.currentNote) return;

		try {
			// Open the note in a new leaf (tab)
			const leaf = this.app.workspace.getLeaf('tab');
			await leaf.openFile(this.currentNote);
			
			// Focus the new leaf
			this.app.workspace.setActiveLeaf(leaf);
			
			// Close the modal
			this.close();
		} catch (error) {
			console.error('Error jumping to note:', error);
			new Notice('Error opening note. Please try again.');
		}
	}

	private async renderNoteContent(container: HTMLElement, content: string): Promise<void> {
		try {
			// Remove frontmatter if present
			const contentWithoutFrontmatter = this.removeFrontmatter(content);
			
			// Limit content length for preview
			const maxLength = 1000;
			let previewContent = contentWithoutFrontmatter.trim();
			let isTruncated = false;

			if (previewContent.length > maxLength) {
				// Try to cut at a reasonable point (end of sentence or paragraph)
				const cutPoint = previewContent.lastIndexOf('\n\n', maxLength) || 
								previewContent.lastIndexOf('. ', maxLength) ||
								previewContent.lastIndexOf('\n', maxLength);
				
				if (cutPoint > maxLength * 0.7) { // Only use cutPoint if it's not too early
					previewContent = previewContent.substring(0, cutPoint);
				} else {
					previewContent = previewContent.substring(0, maxLength);
				}
				isTruncated = true;
			}

			// Use Obsidian's markdown renderer
			const previewEl = container.createEl('div', { cls: 'note-preview-content' });
			
			// Render markdown using Obsidian's renderer
			await this.renderMarkdown(previewContent, previewEl);

			// Add truncation indicator
			if (isTruncated) {
				const truncationIndicator = container.createEl('div', {
					text: '... (content truncated)',
					cls: 'note-preview-truncated'
				});
				truncationIndicator.style.cssText = 'margin-top: 8px; font-style: italic; color: var(--text-muted); font-size: 0.9em;';
			}

			// Style the rendered content
			previewEl.style.cssText = 'font-size: 0.9em; line-height: 1.4;';
			
			// Add specific styling for better readability
			this.styleRenderedContent(previewEl);

		} catch (error) {
			console.error('Error rendering note content:', error);
			// Fallback to plain text
			const fallbackEl = container.createEl('div', { cls: 'note-preview-fallback' });
			const plainContent = this.removeFrontmatter(content).trim();
			const preview = plainContent.length > 500 ? plainContent.substring(0, 500) + '...' : plainContent;
			fallbackEl.textContent = preview || 'Empty note';
			fallbackEl.style.cssText = 'white-space: pre-wrap; font-family: var(--font-monospace); font-size: 0.85em; color: var(--text-muted);';
		}
	}

	private async renderMarkdown(content: string, container: HTMLElement): Promise<void> {
		try {
			// Use Obsidian's MarkdownRenderer
			await MarkdownRenderer.renderMarkdown(
				content,
				container,
				this.currentNote?.path || '',
				this.plugin
			);
		} catch (error) {
			console.error('Error with markdown renderer:', error);
			// Fallback to basic markdown rendering
			this.renderBasicMarkdown(content, container);
		}
	}

	private renderBasicMarkdown(content: string, container: HTMLElement): void {
		// Basic markdown rendering for fallback
		const lines = content.split('\n');
		let inCodeBlock = false;
		let currentParagraph = '';

		for (const line of lines) {
			if (line.startsWith('```')) {
				if (currentParagraph) {
					this.addParagraph(container, currentParagraph);
					currentParagraph = '';
				}
				inCodeBlock = !inCodeBlock;
				if (inCodeBlock) {
					container.createEl('pre', { text: '', cls: 'code-block' });
				}
				continue;
			}

			if (inCodeBlock) {
				const lastPre = container.querySelector('pre:last-child');
				if (lastPre) {
					lastPre.textContent += line + '\n';
				}
				continue;
			}

			if (line.trim() === '') {
				if (currentParagraph) {
					this.addParagraph(container, currentParagraph);
					currentParagraph = '';
				}
				continue;
			}

			if (line.startsWith('#')) {
				if (currentParagraph) {
					this.addParagraph(container, currentParagraph);
					currentParagraph = '';
				}
				const level = Math.min(line.match(/^#+/)?.[0].length || 1, 6);
				const text = line.replace(/^#+\s*/, '');
				const headingTag = `h${level}` as keyof HTMLElementTagNameMap;
				container.createEl(headingTag, { text });
				continue;
			}

			if (line.startsWith('- ') || line.startsWith('* ')) {
				if (currentParagraph) {
					this.addParagraph(container, currentParagraph);
					currentParagraph = '';
				}
				const listItem = container.createEl('li', { text: line.substring(2) });
				continue;
			}

			currentParagraph += (currentParagraph ? ' ' : '') + line;
		}

		if (currentParagraph) {
			this.addParagraph(container, currentParagraph);
		}
	}

	private addParagraph(container: HTMLElement, text: string): void {
		const p = container.createEl('p');
		// Handle basic inline formatting
		const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/);
		
		for (const part of parts) {
			if (part.startsWith('**') && part.endsWith('**')) {
				p.createEl('strong', { text: part.slice(2, -2) });
			} else if (part.startsWith('*') && part.endsWith('*')) {
				p.createEl('em', { text: part.slice(1, -1) });
			} else if (part.startsWith('`') && part.endsWith('`')) {
				p.createEl('code', { text: part.slice(1, -1) });
			} else {
				p.appendText(part);
			}
		}
	}

	private styleRenderedContent(container: HTMLElement): void {
		// Style headings
		const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
		headings.forEach((heading) => {
			(heading as HTMLElement).style.cssText += 'margin: 8px 0 4px 0; font-weight: 600;';
		});

		// Style paragraphs
		const paragraphs = container.querySelectorAll('p');
		paragraphs.forEach((p) => {
			(p as HTMLElement).style.cssText += 'margin: 4px 0; line-height: 1.5;';
		});

		// Style lists
		const lists = container.querySelectorAll('ul, ol');
		lists.forEach((list) => {
			(list as HTMLElement).style.cssText += 'margin: 4px 0; padding-left: 20px;';
		});

		// Style code blocks
		const codeBlocks = container.querySelectorAll('pre');
		codeBlocks.forEach((block) => {
			(block as HTMLElement).style.cssText += 'background: var(--background-primary-alt); padding: 8px; border-radius: 4px; margin: 8px 0; overflow-x: auto; font-family: var(--font-monospace);';
		});

		// Style inline code
		const inlineCode = container.querySelectorAll('code:not(pre code)');
		inlineCode.forEach((code) => {
			(code as HTMLElement).style.cssText += 'background: var(--background-primary-alt); padding: 2px 4px; border-radius: 3px; font-family: var(--font-monospace); font-size: 0.9em;';
		});

		// Style blockquotes
		const blockquotes = container.querySelectorAll('blockquote');
		blockquotes.forEach((quote) => {
			(quote as HTMLElement).style.cssText += 'border-left: 3px solid var(--text-accent); margin: 8px 0; padding-left: 12px; color: var(--text-muted); font-style: italic;';
		});

		// Style links
		const links = container.querySelectorAll('a');
		links.forEach((link) => {
			(link as HTMLElement).style.cssText += 'color: var(--text-accent); text-decoration: none;';
		});
	}

	private sanitizeContextKey(context: string): string {
		// Convert to lowercase and replace non-alphanumeric characters with dashes
		return context
			.toLowerCase()
			.trim()
			// Replace sequences of non-alphanumeric characters with single dashes
			.replace(/[^a-z0-9]+/g, '-')
			// Remove leading/trailing dashes
			.replace(/^-+|-+$/g, '')
			// Ensure we don't end up with an empty string
			|| 'context';
	}

	private removeFrontmatter(content: string): string {
		// Remove YAML frontmatter if present
		if (content.startsWith('---')) {
			const frontmatterEnd = content.indexOf('---', 3);
			if (frontmatterEnd !== -1) {
				return content.substring(frontmatterEnd + 3).trim();
			}
		}
		return content;
	}
}
