import { Setting } from 'obsidian';

import { BaseActionHandler } from './baseActionHandler';

export class EvaluateActionHandler extends BaseActionHandler {
	private evaluationText = '';

	getPromptText(): string {
		return 'Evaluate';
	}

	async renderNoteContent(container: HTMLElement): Promise<void> {
		// First render the note content
		await super.renderNoteContent(container);

		// Then add the evaluation text box using Obsidian's Setting component
		const evaluationContainer = container.createEl('div');
		evaluationContainer.className = 'evaluation-container';

		new Setting(evaluationContainer)
			.setName('Your evaluation')
			.setDesc('Write your evaluation of this note')
			.addTextArea((textArea) => {
				textArea.setPlaceholder('Write your evaluation here...');
				textArea.setValue(this.evaluationText);
				textArea.onChange((value) => {
					this.evaluationText = value;
				});
			});
	}

	createButtons(buttonContainer: HTMLElement): void {
		this.context.createButton(buttonContainer, 'Change Context', this.context.onChangeContext);
		this.context.createButton(buttonContainer, 'Jump to Note', this.context.onJumpToNote);
		this.context.createButton(buttonContainer, 'Save and Next', async () => {
			await this.handleDone();
		});
	}

	private async handleDone(): Promise<void> {
		if (!this.evaluationText.trim()) {
			this.context.showError('Please enter an evaluation before clicking Save and Next.');
			return;
		}

		try {
			// Read the current note content
			const currentContent = await this.context.app.vault.read(this.context.currentNote);
			
			// Get current date in yyyy-mm-dd format
			const today = new Date();
			const dateStr = today.getFullYear().toString() + '-' +
				String(today.getMonth() + 1).padStart(2, '0') + '-' +
				String(today.getDate()).padStart(2, '0');
			
			// Add the evaluation as a bullet point with date
			const evaluationBullet = `- ${dateStr} ${this.evaluationText.trim()}`;
			const newContent = currentContent + '\n\n' + evaluationBullet;
			
			// Write back to the note
			await this.context.app.vault.modify(this.context.currentNote, newContent);
			
			// Proceed to next note
			await this.context.onNext();
		} catch (error) {
			this.context.showError('Error saving evaluation. Please try again.');
		}
	}

	cleanup(): void {
		this.evaluationText = '';
	}
}