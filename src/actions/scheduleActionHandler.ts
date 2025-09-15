import { BaseActionHandler } from './baseActionHandler';

export class ScheduleActionHandler extends BaseActionHandler {
	getPromptText(): string {
		return 'Write down when and where you are going to do this';
	}

	createButtons(buttonContainer: HTMLElement): void {
		this.context.createButton(buttonContainer, 'Jump to Note', this.context.onJumpToNote);
		this.context.createButton(buttonContainer, 'Remove Context', this.context.onRemoveContext);
		this.context.createButton(buttonContainer, 'Delete Note', this.context.onDeleteNote);
		this.context.createButton(buttonContainer, 'Next', this.context.onNext);
	}
}