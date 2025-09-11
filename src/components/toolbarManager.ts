import { App, Plugin, MarkdownView, TFile, WorkspaceLeaf } from 'obsidian';
import { SeeYouAgainSettings } from '../types';
import { ContextToolbar } from './contextToolbar';

export class ToolbarManager {
	private app: App;
	private plugin: Plugin & { settings: SeeYouAgainSettings; saveSettings(): Promise<void> };
	private toolbars: Map<string, ContextToolbar> = new Map();
	private activeLeaf: WorkspaceLeaf | null = null;

	constructor(app: App, plugin: Plugin & { settings: SeeYouAgainSettings; saveSettings(): Promise<void> }) {
		this.app = app;
		this.plugin = plugin;
		this.setupEventListeners();
	}

	private setupEventListeners(): void {
		// Listen for active leaf changes
		this.app.workspace.on('active-leaf-change', (leaf) => {
			this.handleLeafChange(leaf);
		});

		// Listen for file opens
		this.app.workspace.on('file-open', (file) => {
			if (file) {
				this.handleFileOpen(file);
			}
		});

		// Listen for layout changes (split/close panes)
		this.app.workspace.on('layout-change', () => {
			this.cleanupInvalidToolbars();
		});

		// Listen for metadata changes to refresh toolbars
		this.app.metadataCache.on('changed', (file) => {
			this.refreshToolbarForFile(file);
		});
	}

	private handleLeafChange(leaf: WorkspaceLeaf | null): void {
		this.activeLeaf = leaf;
		
		if (!leaf) {
			return;
		}

		const view = leaf.view;
		if (!(view instanceof MarkdownView) || !view.file) {
			return;
		}

		this.ensureToolbarForFile(view.file, leaf);
	}

	private handleFileOpen(file: TFile): void {
		if (!this.activeLeaf) {
			return;
		}

		const view = this.activeLeaf.view;
		if (!(view instanceof MarkdownView)) {
			return;
		}

		this.ensureToolbarForFile(file, this.activeLeaf);
	}

	private ensureToolbarForFile(file: TFile, leaf: WorkspaceLeaf): void {
		const leafId = this.getLeafId(leaf);
		const toolbarKey = `${leafId}-${file.path}`;

		// Remove any existing toolbar for this leaf
		this.removeToolbarForLeaf(leafId);

		// Only show toolbar for markdown files
		if (file.extension !== 'md') {
			return;
		}

		// Check if this file can have contexts (is eligible or already has contexts)
		this.shouldShowToolbar(file).then(shouldShow => {
			if (shouldShow) {
				this.createToolbar(file, leaf, toolbarKey);
			}
		});
	}

	private async shouldShowToolbar(file: TFile): Promise<boolean> {
		try {
			const fileCache = this.app.metadataCache.getFileCache(file);
			const frontmatter = fileCache?.frontmatter;
			
			// Show if file already has see-you-again metadata
			if (frontmatter && frontmatter['see-you-again']) {
				return true;
			}

			// Show for all markdown files (they can all potentially have contexts)
			return true;
		} catch (error) {
			console.error('Error checking if toolbar should show:', error);
			return false;
		}
	}

	private createToolbar(file: TFile, leaf: WorkspaceLeaf, toolbarKey: string): void {
		const view = leaf.view;
		if (!(view instanceof MarkdownView)) {
			return;
		}

		// Find the content container for the leaf
		const contentContainer = this.findContentContainer(leaf);
		if (!contentContainer) {
			console.warn('Could not find content container for leaf');
			return;
		}

		// Create and store the toolbar
		const toolbar = new ContextToolbar(this.app, this.plugin, file, contentContainer);
		this.toolbars.set(toolbarKey, toolbar);
	}

	private findContentContainer(leaf: WorkspaceLeaf): HTMLElement | null {
		// Look for the workspace leaf content container
		const leafContainer = (leaf as any).containerEl;
		if (!leafContainer) {
			return null;
		}

		// Find the content area within the leaf
		const contentEl = leafContainer.querySelector('.workspace-leaf-content');
		return contentEl as HTMLElement;
	}

	private removeToolbarForLeaf(leafId: string): void {
		// Remove all toolbars associated with this leaf
		const keysToRemove: string[] = [];
		
		this.toolbars.forEach((toolbar, key) => {
			if (key.startsWith(leafId + '-')) {
				toolbar.destroy();
				keysToRemove.push(key);
			}
		});

		keysToRemove.forEach(key => this.toolbars.delete(key));
	}

	private cleanupInvalidToolbars(): void {
		// Remove toolbars for leaves that no longer exist
		const validLeafIds = new Set<string>();
		
		this.app.workspace.iterateAllLeaves(leaf => {
			validLeafIds.add(this.getLeafId(leaf));
		});

		const keysToRemove: string[] = [];
		
		this.toolbars.forEach((toolbar, key) => {
			const leafId = key.split('-')[0];
			if (!validLeafIds.has(leafId)) {
				toolbar.destroy();
				keysToRemove.push(key);
			}
		});

		keysToRemove.forEach(key => this.toolbars.delete(key));
	}

	private refreshToolbarForFile(file: TFile): void {
		// Find and refresh toolbars showing this file
		this.toolbars.forEach((toolbar, key) => {
			if (key.endsWith(file.path)) {
				toolbar.refresh();
			}
		});
	}

	private getLeafId(leaf: WorkspaceLeaf): string {
		// Use a combination of properties to create a unique ID for the leaf
		return (leaf as any).id || 
			   `${leaf.getViewState().type}-${Date.now()}-${Math.random()}`;
	}

	public destroy(): void {
		// Clean up all toolbars
		this.toolbars.forEach(toolbar => toolbar.destroy());
		this.toolbars.clear();

		// Note: Event listeners are automatically cleaned up by Obsidian when plugin unloads
	}
}
