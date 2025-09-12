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
		const changeContextButton = this.context.createStyledButton('Change Context', this.context.onChangeContext);
		const jumpButton = this.context.createStyledButton('Jump to Note', async () => {
			await this.context.onJumpToNote();
			// After jumping, we need to track if the note gets modified
			this.startTrackingModifications();
		});
		const doneButton = this.context.createStyledButton('Done', async () => {
			if (this.isNoteModified) {
				await this.context.onNext();
			}
		});
		const nextButton = this.context.createStyledButton('Next', this.context.onNext);

		// Initially disable the Done button
		doneButton.addClass('button-disabled');
		doneButton.setAttribute('disabled', 'true');

		buttonContainer.appendChild(changeContextButton);
		buttonContainer.appendChild(jumpButton);
		buttonContainer.appendChild(doneButton);
		buttonContainer.appendChild(nextButton);

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
		const doneButton = (this as any).doneButton;
		if (doneButton) {
			doneButton.removeClass('button-disabled');
			doneButton.removeAttribute('disabled');
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