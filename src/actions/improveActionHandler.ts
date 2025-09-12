import { ButtonComponent } from 'obsidian';
import { BaseActionHandler } from './baseActionHandler';

export class ImproveActionHandler extends BaseActionHandler {
	private isNoteModified: boolean = false;
	private originalModTime: number = 0;

	async initialize(): Promise<void> {
		// Store the original modification time
		this.originalModTime = this.context.currentNote.stat.mtime;
		this.isNoteModified = false;
	}

	getPromptText(): string {
		return 'Improve this note';
	}

	createButtons(buttonContainer: HTMLElement): void {
		this.context.createButton(buttonContainer, 'Change Context', this.context.onChangeContext);
		
		this.context.createButton(buttonContainer, 'Jump to Note', async () => {
			await this.context.onJumpToNote();
			// After jumping, we need to track if the note gets modified
			this.startTrackingModifications();
		});
		
		const doneButton = new ButtonComponent(buttonContainer);
		doneButton.setButtonText('Done');
		doneButton.setDisabled(true); // Initially disabled
		doneButton.onClick(async () => {
			if (this.isNoteModified) {
				await this.context.onNext();
			}
		});

		this.context.createButton(buttonContainer, 'Next', this.context.onNext);

		// Store reference to done button for later enabling
		(this as any).doneButton = doneButton;
	}

	private startTrackingModifications(): void {
		// Set up a periodic check to see if the note has been modified
		const checkInterval = setInterval(() => {
			const currentModTime = this.context.currentNote.stat.mtime;
			if (currentModTime > this.originalModTime && !this.isNoteModified) {
				this.isNoteModified = true;
				this.enableDoneButton();
				clearInterval(checkInterval);
			}
		}, 1000); // Check every second

		// Store interval reference for cleanup
		(this as any).trackingInterval = checkInterval;
	}

	private enableDoneButton(): void {
		const doneButton = (this as any).doneButton as ButtonComponent;
		if (doneButton) {
			doneButton.setDisabled(false);
		}
	}

	cleanup(): void {
		// Clear any tracking intervals
		const trackingInterval = (this as any).trackingInterval;
		if (trackingInterval) {
			clearInterval(trackingInterval);
		}
	}
}