import { App, Modal, TFile, Notice, Plugin } from 'obsidian';
import { SeeYouAgainSettings } from '../types';

export abstract class BaseNoteModal extends Modal {
	protected currentNote: TFile | null = null;
	protected plugin: Plugin & { settings: SeeYouAgainSettings; saveSettings(): Promise<void> };

	constructor(app: App, plugin: Plugin & { settings: SeeYouAgainSettings; saveSettings(): Promise<void> }) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		// Add our namespace class to the modal
		this.containerEl.addClass('see-you-again-modal');
		super.onOpen();
	}

	/**
	 * Jump to the current note in a new tab
	 */
	protected async jumpToNote(): Promise<void> {
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
			this.showError('Error opening note. Please try again.');
		}
	}

	/**
	 * Show error message to user
	 */
	protected showError(message: string): void {
		new Notice(message);
	}

	/**
	 * Show success message to user
	 */
	protected showSuccess(message: string): void {
		new Notice(message);
	}

	/**
	 * Clean up modal resources
	 */
	protected cleanup(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.currentNote = null;
	}

	/**
	 * Create a styled button with hover effects
	 */
	protected createStyledButton(
		text: string, 
		onClick: () => void, 
		variant: 'primary' | 'secondary' | 'accent' = 'secondary'
	): HTMLButtonElement {
		const button = document.createElement('button');
		button.textContent = text;
		button.className = `base-modal-button base-modal-button-${variant}`;

		button.addEventListener('click', onClick);
		return button;
	}

	/**
	 * Create a header section with title and optional button
	 */
	protected createHeader(title: string, buttonText?: string, buttonClick?: () => void): HTMLElement {
		const header = this.contentEl.createEl('div');
		header.className = 'base-modal-header';
		
		if (buttonText && buttonClick) {
			// Header with button
			const headerTop = header.createEl('div');
			headerTop.className = 'base-modal-header-with-button';
			
			const titleEl = headerTop.createEl('h3', { text: title });
			titleEl.className = 'base-modal-header-title-with-button';
			
			const button = this.createStyledButton(buttonText, buttonClick, 'accent');
			headerTop.appendChild(button);
		} else {
			// Simple header
			const titleEl = header.createEl('h2', { text: title });
			titleEl.className = 'base-modal-header-title';
		}

		return header;
	}

	onClose(): void {
		this.cleanup();
	}
}
