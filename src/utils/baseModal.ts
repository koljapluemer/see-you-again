import { App, Modal, TFile, Notice, ButtonComponent } from 'obsidian';
import { SeeYouAgainPlugin } from '../types';

export abstract class BaseNoteModal extends Modal {
	protected currentNote: TFile | null = null;
	protected plugin: SeeYouAgainPlugin;

	constructor(app: App, plugin: SeeYouAgainPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		// Add our namespace class to the modal
		this.containerEl.addClass('see-you-again-modal');
		super.onOpen();
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
	 * Create a native Obsidian button
	 */
	protected createStyledButton(text: string, onClick: () => void): HTMLButtonElement {
		const buttonContainer = document.createElement('div');
		const buttonComponent = new ButtonComponent(buttonContainer);
		
		buttonComponent.setButtonText(text);
		buttonComponent.onClick(onClick);
		
		return buttonComponent.buttonEl;
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
			
			const button = this.createStyledButton(buttonText, buttonClick);
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
