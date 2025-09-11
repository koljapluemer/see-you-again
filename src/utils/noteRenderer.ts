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

			// Style the rendered content
			previewEl.style.cssText = 'font-size: 0.9em; line-height: 1.4;';
			
			// Add specific styling for better readability
			this.styleRenderedContent(previewEl);

		} catch (error) {
			console.error('Error rendering note content:', error);
			// Fallback to plain text
			const fallbackEl = container.createEl('div', { cls: 'note-preview-fallback' });
			const plainContent = this.removeFrontmatter(content).trim();
			fallbackEl.textContent = plainContent || 'Empty note';
			fallbackEl.style.cssText = 'white-space: pre-wrap; font-family: var(--font-monospace); font-size: 0.85em; color: var(--text-muted);';
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
