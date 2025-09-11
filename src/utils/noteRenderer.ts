import { App, TFile, Plugin, MarkdownRenderer } from 'obsidian';

export class NoteRenderer {
	/**
	 * Render note content with full markdown support
	 */
	static async renderNoteContent(
		container: HTMLElement, 
		content: string, 
		currentNote: TFile | null,
		app: App,
		plugin: Plugin
	): Promise<void> {
		try {
			// Remove frontmatter if present
			const contentWithoutFrontmatter = this.removeFrontmatter(content);
			const previewContent = contentWithoutFrontmatter.trim();

			// Use Obsidian's markdown renderer
			const previewEl = container.createEl('div', { cls: 'note-preview-content' });
			
			// Render markdown using Obsidian's renderer
			await this.renderMarkdown(previewContent, previewEl, currentNote, app, plugin);
			
			// Add specific styling for better readability
			this.styleRenderedContent(previewEl);

		} catch (error) {
			console.error('Error rendering note content:', error);
			// Fallback to plain text
			const fallbackEl = container.createEl('div', { cls: 'note-preview-fallback' });
			const plainContent = this.removeFrontmatter(content).trim();
			fallbackEl.textContent = plainContent || 'Empty note';
		}
	}

	/**
	 * Render markdown content using Obsidian's renderer with fallback
	 */
	static async renderMarkdown(
		content: string, 
		container: HTMLElement, 
		currentNote: TFile | null,
		app: App,
		plugin: Plugin
	): Promise<void> {
		try {
			// Use Obsidian's MarkdownRenderer
			await MarkdownRenderer.renderMarkdown(
				content,
				container,
				currentNote?.path || '',
				plugin
			);
		} catch (error) {
			console.error('Error with markdown renderer:', error);
			// Fallback to basic markdown rendering
			this.renderBasicMarkdown(content, container);
		}
	}

	/**
	 * Basic markdown rendering fallback
	 */
	static renderBasicMarkdown(content: string, container: HTMLElement): void {
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

	/**
	 * Add a paragraph with basic inline formatting
	 */
	private static addParagraph(container: HTMLElement, text: string): void {
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

	/**
	 * Style rendered content for better readability
	 */
	static styleRenderedContent(container: HTMLElement): void {
		// Add CSS classes to elements for styling
		container.classList.add('note-renderer-content');
		
		// Style headings
		const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
		headings.forEach((heading) => {
			heading.classList.add('note-renderer-heading');
		});

		// Style paragraphs
		const paragraphs = container.querySelectorAll('p');
		paragraphs.forEach((p) => {
			p.classList.add('note-renderer-paragraph');
		});

		// Style lists
		const lists = container.querySelectorAll('ul, ol');
		lists.forEach((list) => {
			list.classList.add('note-renderer-list');
		});

		// Style code blocks
		const codeBlocks = container.querySelectorAll('pre');
		codeBlocks.forEach((block) => {
			block.classList.add('note-renderer-code-block');
		});

		// Style inline code
		const inlineCode = container.querySelectorAll('code:not(pre code)');
		inlineCode.forEach((code) => {
			code.classList.add('note-renderer-inline-code');
		});

		// Style blockquotes
		const blockquotes = container.querySelectorAll('blockquote');
		blockquotes.forEach((quote) => {
			quote.classList.add('note-renderer-blockquote');
		});

		// Style links
		const links = container.querySelectorAll('a');
		links.forEach((link) => {
			link.classList.add('note-renderer-link');
		});
	}

	/**
	 * Remove YAML frontmatter from content
	 */
	static removeFrontmatter(content: string): string {
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
