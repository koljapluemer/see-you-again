import type { App, TFile, Plugin} from 'obsidian';
import { MarkdownRenderer, MarkdownRenderChild } from 'obsidian';

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
		
	}

	/**
	 * Render markdown content using Obsidian's renderer with proper MarkdownRenderChild
	 */
	static renderMarkdown(
		content: string,
		container: HTMLElement,
		currentNote: TFile | null,
		app: App,
		_plugin: Plugin
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
