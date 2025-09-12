import { App, TFile, Plugin, MarkdownRenderer, MarkdownRenderChild } from 'obsidian';

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
		// Remove frontmatter if present
		const contentWithoutFrontmatter = this.removeFrontmatter(content);
		const previewContent = contentWithoutFrontmatter.trim();

		// Use Obsidian's markdown renderer
		const previewEl = container.createEl('div', { cls: 'note-preview-content' });
		
		// Render markdown using Obsidian's renderer - this handles images, wikilinks, etc.
		this.renderMarkdown(previewContent, previewEl, currentNote, app, plugin);
		
		// Add specific styling for better readability
		this.styleRenderedContent(previewEl);
	}

	/**
	 * Render markdown content using Obsidian's renderer with proper MarkdownRenderChild
	 */
	static renderMarkdown(
		content: string, 
		container: HTMLElement, 
		currentNote: TFile | null,
		app: App,
		plugin: Plugin
	): void {
		// Create a MarkdownRenderChild for proper rendering and component lifecycle
		const renderChild = new MarkdownRenderChild(container);
		
		// Use the current MarkdownRenderer.render() API (not deprecated renderMarkdown)
		MarkdownRenderer.render(
			app,
			content,
			container,
			currentNote?.path || '',
			renderChild
		);
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
