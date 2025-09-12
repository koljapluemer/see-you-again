import { BaseActionHandler } from './baseActionHandler';

export class IterateActionHandler extends BaseActionHandler {
	getPromptText(): string {
		return 'Make some progress with this';
	}

	createButtons(buttonContainer: HTMLElement): void {
		this.context.createButton(buttonContainer, 'Change Context', this.context.onChangeContext);
		this.context.createButton(buttonContainer, 'Jump to Note', this.context.onJumpToNote);
		this.context.createButton(buttonContainer, 'Remove Context', this.context.onRemoveContext);
		this.context.createButton(buttonContainer, 'Remove Context and Archive', this.context.onRemoveContextAndArchive);
		this.context.createButton(buttonContainer, 'Delete Note', this.context.onDeleteNote);
		this.context.createButton(buttonContainer, 'Next', this.context.onNext);
	}
}