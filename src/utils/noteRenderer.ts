import type { App, TFile, Plugin} from 'obsidian';
import { MarkdownRenderer, MarkdownRenderChild } from 'obsidian';

export class NoteRenderer {
	/**
	 * Render note content with full markdown support
	 * Returns the MarkdownRenderChild for proper cleanup
	 */
	static renderNoteContent(
		container: HTMLElement,
		content: string,
		currentNote: TFile | null,
		app: App,
		plugin: Plugin
	): MarkdownRenderChild {
		// Remove frontmatter if present
		const contentWithoutFrontmatter = this.removeFrontmatter(content);
		const previewContent = contentWithoutFrontmatter.trim();

		// Use Obsidian's markdown renderer
		const previewEl = container.createEl('div', { cls: 'note-preview-content' });

		// Render markdown using Obsidian's renderer - this handles images, wikilinks, etc.
		return this.renderMarkdown(previewContent, previewEl, currentNote, app, plugin);
	}

	/**
	 * Render markdown content using Obsidian's renderer with proper MarkdownRenderChild
	 * Returns the MarkdownRenderChild for proper cleanup
	 */
	static renderMarkdown(
		content: string,
		container: HTMLElement,
		currentNote: TFile | null,
		app: App,
		_plugin: Plugin
	): MarkdownRenderChild {
		// Create a MarkdownRenderChild for proper rendering and component lifecycle
		const renderChild = new MarkdownRenderChild(container);

		// Use the current MarkdownRenderer.render() API (not deprecated renderMarkdown)
		MarkdownRenderer.render(
			app,
			content,
			container,
			(currentNote?.path !== null && currentNote?.path !== undefined) ? currentNote.path : '',
			renderChild
		).catch(error => console.error('Failed to render markdown:', error));

		return renderChild;
	}


	/**
	 * Remove YAML frontmatter from content
	 */
	static removeFrontmatter(content: string): string {
		// Remove YAML frontmatter if present
		if (content !== null && content !== undefined && content !== '' && content.startsWith('---')) {
			const frontmatterEnd = content.indexOf('---', 3);
			if (frontmatterEnd !== -1 && frontmatterEnd > 0) {
				return content.substring(frontmatterEnd + 3).trim();
			}
		}
		return content;
	}
}
