import { App, Modal, TFile, Notice, Plugin, MarkdownRenderer } from 'obsidian';
import { NoteService } from './noteService';
import { SeeYouAgainSettings } from './types';

export class ContextNoteViewerModal extends Modal {
	private plugin: Plugin & { settings: SeeYouAgainSettings; saveSettings(): Promise<void> };
	private noteService: NoteService;
	private hydratedContext: string;
	private sanitizedContext: string;
	private currentNote: TFile | null = null;

	constructor(
		app: App, 
		plugin: Plugin & { settings: SeeYouAgainSettings; saveSettings(): Promise<void> },
		hydratedContext: string,
		sanitizedContext: string
	) {
		super(app);
		this.plugin = plugin;
		this.noteService = new NoteService(app);
		this.hydratedContext = hydratedContext;
		this.sanitizedContext = sanitizedContext;
	}

	async onOpen(): Promise<void> {
		await this.loadRandomNote();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.currentNote = null;
	}

	private async loadRandomNote(): Promise<void> {
		try {
			this.currentNote = await this.noteService.getRandomNoteWithContext(this.sanitizedContext);
			
			if (!this.currentNote) {
				this.showNoNotesMessage();
				return;
			}

			await this.renderModal();
		} catch (error) {
			console.error('Error loading random note with context:', error);
			new Notice('Error loading note. Please try again.');
		}
	}

	private showNoNotesMessage(): void {
		const { contentEl } = this;
		contentEl.empty();
		
		const header = contentEl.createEl('div');
		header.style.cssText = 'text-align: center; padding: 40px 20px;';
		
		header.createEl('h2', { text: 'No Notes Found' });
		header.createEl('p', { 
			text: `No notes found with the context "${this.hydratedContext}".` 
		});
		
		const closeButton = header.createEl('button', { text: 'Close' });
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
		
		// Context and note title row
		const headerTop = header.createEl('div');
		headerTop.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;';
		
		const titleSection = headerTop.createEl('div');
		const contextLabel = titleSection.createEl('div', { text: `Context: ${this.hydratedContext}` });
		contextLabel.style.cssText = 'font-size: 14px; color: var(--text-muted); margin-bottom: 4px;';
		
		const noteTitle = titleSection.createEl('h3', { text: this.currentNote.basename });
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
		previewContainer.style.cssText = 'margin-bottom: 20px; padding: 12px; background: var(--background-secondary); border-radius: 6px; max-height: 400px; overflow-y: auto; border: 1px solid var(--background-modifier-border);';
		
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

		// Next button
		const buttonContainer = contentEl.createEl('div');
		buttonContainer.style.cssText = 'text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--background-modifier-border);';
		
		const nextButton = buttonContainer.createEl('button', { text: 'Next' });
		nextButton.style.cssText = `
			padding: 8px 24px;
			border: 1px solid var(--interactive-accent);
			border-radius: 4px;
			background: var(--interactive-accent);
			color: var(--text-on-accent);
			cursor: pointer;
			font-size: 14px;
			transition: all 0.2s ease;
		`;
		
		nextButton.addEventListener('click', () => this.handleNext());
	}

	private async handleJumpToNote(): Promise<void> {
		if (!this.currentNote) return;

		try {
			const leaf = this.app.workspace.getLeaf('tab');
			await leaf.openFile(this.currentNote);
			this.app.workspace.setActiveLeaf(leaf);
			this.close();
		} catch (error) {
			console.error('Error jumping to note:', error);
			new Notice('Error opening note. Please try again.');
		}
	}

	private async handleNext(): Promise<void> {
		await this.loadRandomNote();
	}

	private async renderNoteContent(container: HTMLElement, content: string): Promise<void> {
		try {
			const contentWithoutFrontmatter = this.removeFrontmatter(content);
			
			const maxLength = 1500;
			let previewContent = contentWithoutFrontmatter.trim();
			let isTruncated = false;

			if (previewContent.length > maxLength) {
				const cutPoint = previewContent.lastIndexOf('\n\n', maxLength) || 
								previewContent.lastIndexOf('. ', maxLength) ||
								previewContent.lastIndexOf('\n', maxLength);
				
				if (cutPoint > maxLength * 0.7) {
					previewContent = previewContent.substring(0, cutPoint);
				} else {
					previewContent = previewContent.substring(0, maxLength);
				}
				isTruncated = true;
			}

			const previewEl = container.createEl('div', { cls: 'note-preview-content' });
			
			await this.renderMarkdown(previewContent, previewEl);

			if (isTruncated) {
				const truncationIndicator = container.createEl('div', {
					text: '... (content truncated)',
					cls: 'note-preview-truncated'
				});
				truncationIndicator.style.cssText = 'margin-top: 8px; font-style: italic; color: var(--text-muted); font-size: 0.9em;';
			}

			previewEl.style.cssText = 'font-size: 0.9em; line-height: 1.4;';
			this.styleRenderedContent(previewEl);

		} catch (error) {
			console.error('Error rendering note content:', error);
			const fallbackEl = container.createEl('div', { cls: 'note-preview-fallback' });
			const plainContent = this.removeFrontmatter(content).trim();
			const preview = plainContent.length > 500 ? plainContent.substring(0, 500) + '...' : plainContent;
			fallbackEl.textContent = preview || 'Empty note';
			fallbackEl.style.cssText = 'white-space: pre-wrap; font-family: var(--font-monospace); font-size: 0.85em; color: var(--text-muted);';
		}
	}

	private async renderMarkdown(content: string, container: HTMLElement): Promise<void> {
		try {
			await MarkdownRenderer.renderMarkdown(
				content,
				container,
				this.currentNote?.path || '',
				this.plugin
			);
		} catch (error) {
			console.error('Error with markdown renderer:', error);
			this.renderBasicMarkdown(content, container);
		}
	}

	private renderBasicMarkdown(content: string, container: HTMLElement): void {
		const lines = content.split('\n');
		let currentParagraph = '';

		for (const line of lines) {
			if (line.trim() === '') {
				if (currentParagraph) {
					const p = container.createEl('p');
					p.textContent = currentParagraph;
					currentParagraph = '';
				}
				continue;
			}

			if (line.startsWith('#')) {
				if (currentParagraph) {
					const p = container.createEl('p');
					p.textContent = currentParagraph;
					currentParagraph = '';
				}
				const level = Math.min(line.match(/^#+/)?.[0].length || 1, 6);
				const text = line.replace(/^#+\s*/, '');
				const headingTag = `h${level}` as keyof HTMLElementTagNameMap;
				container.createEl(headingTag, { text });
				continue;
			}

			currentParagraph += (currentParagraph ? ' ' : '') + line;
		}

		if (currentParagraph) {
			const p = container.createEl('p');
			p.textContent = currentParagraph;
		}
	}

	private styleRenderedContent(container: HTMLElement): void {
		const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
		headings.forEach((heading) => {
			(heading as HTMLElement).style.cssText += 'margin: 8px 0 4px 0; font-weight: 600;';
		});

		const paragraphs = container.querySelectorAll('p');
		paragraphs.forEach((p) => {
			(p as HTMLElement).style.cssText += 'margin: 4px 0; line-height: 1.5;';
		});

		const codeBlocks = container.querySelectorAll('pre');
		codeBlocks.forEach((block) => {
			(block as HTMLElement).style.cssText += 'background: var(--background-primary-alt); padding: 8px; border-radius: 4px; margin: 8px 0; overflow-x: auto; font-family: var(--font-monospace);';
		});

		const inlineCode = container.querySelectorAll('code:not(pre code)');
		inlineCode.forEach((code) => {
			(code as HTMLElement).style.cssText += 'background: var(--background-primary-alt); padding: 2px 4px; border-radius: 3px; font-family: var(--font-monospace); font-size: 0.9em;';
		});
	}

	private removeFrontmatter(content: string): string {
		if (content.startsWith('---')) {
			const frontmatterEnd = content.indexOf('---', 3);
			if (frontmatterEnd !== -1) {
				return content.substring(frontmatterEnd + 3).trim();
			}
		}
		return content;
	}
}
