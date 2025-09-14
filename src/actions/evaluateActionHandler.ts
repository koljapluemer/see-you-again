import { BaseActionHandler } from './baseActionHandler';

export class EvaluateActionHandler extends BaseActionHandler {
	private evaluationText = '';
	private textArea: HTMLTextAreaElement | null = null;

	getPromptText(): string {
		return 'Evaluate';
	}

	async renderNoteContent(container: HTMLElement): Promise<void> {
		// First render the note content
		await super.renderNoteContent(container);

		// Then add the evaluation text box
		const evaluationContainer = container.createEl('div');
		evaluationContainer.className = 'evaluation-container';
		evaluationContainer.style.marginTop = '20px';

		evaluationContainer.createEl('label', { text: 'Your evaluation:' });

		this.textArea = evaluationContainer.createEl('textarea');
		this.textArea.placeholder = 'Write your evaluation here...';

		this.textArea.addEventListener('input', (e) => {
			this.evaluationText = (e.target as HTMLTextAreaElement).value;
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
		this.textArea = null;
		this.evaluationText = '';
	}
}