import { App, Modal, TFile, Notice, Plugin } from 'obsidian';
import { SeeYouAgainSettings } from '../types';

export abstract class BaseNoteModal extends Modal {
	protected currentNote: TFile | null = null;
	protected plugin: Plugin & { settings: SeeYouAgainSettings; saveSettings(): Promise<void> };

	constructor(app: App, plugin: Plugin & { settings: SeeYouAgainSettings; saveSettings(): Promise<void> }) {
		super(app);
		this.plugin = plugin;
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
		
		const baseStyles = `
			padding: 4px 12px;
			border: 1px solid var(--background-modifier-border);
			border-radius: 4px;
			cursor: pointer;
			font-size: 12px;
			transition: all 0.2s ease;
		`;

		switch (variant) {
			case 'primary':
				button.style.cssText = baseStyles + `
					background: var(--interactive-accent);
					color: var(--text-on-accent);
					border-color: var(--interactive-accent);
				`;
				break;
			case 'accent':
				button.style.cssText = baseStyles + `
					background: var(--background-primary);
					color: var(--interactive-accent);
					border-color: var(--interactive-accent);
				`;
				button.addEventListener('mouseenter', () => {
					button.style.backgroundColor = 'var(--interactive-accent)';
					button.style.color = 'var(--text-on-accent)';
				});
				button.addEventListener('mouseleave', () => {
					button.style.backgroundColor = 'var(--background-primary)';
					button.style.color = 'var(--interactive-accent)';
				});
				break;
			default:
				button.style.cssText = baseStyles + `
					background: var(--background-secondary);
					color: var(--text-normal);
				`;
		}

		button.addEventListener('click', onClick);
		return button;
	}

	/**
	 * Create a header section with title and optional button
	 */
	protected createHeader(title: string, buttonText?: string, buttonClick?: () => void): HTMLElement {
		const header = this.contentEl.createEl('div');
		header.style.cssText = 'margin-bottom: 20px; border-bottom: 1px solid var(--background-modifier-border); padding-bottom: 15px;';
		
		if (buttonText && buttonClick) {
			// Header with button
			const headerTop = header.createEl('div');
			headerTop.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;';
			
			const titleEl = headerTop.createEl('h3', { text: title });
			titleEl.style.cssText = 'margin: 0; color: var(--text-accent); font-weight: normal;';
			
			const button = this.createStyledButton(buttonText, buttonClick, 'accent');
			headerTop.appendChild(button);
		} else {
			// Simple header
			const titleEl = header.createEl('h2', { text: title });
			titleEl.style.cssText = 'margin: 0; color: var(--text-normal);';
		}

		return header;
	}

	onClose(): void {
		this.cleanup();
	}
}
