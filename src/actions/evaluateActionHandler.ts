import { BaseActionHandler } from './baseActionHandler';

export class EvaluateActionHandler extends BaseActionHandler {
	private evaluationText: string = '';
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

		const label = evaluationContainer.createEl('label', { text: 'Your evaluation:' });
		label.style.display = 'block';
		label.style.marginBottom = '8px';
		label.style.fontWeight = 'bold';

		this.textArea = evaluationContainer.createEl('textarea');
		this.textArea.placeholder = 'Write your evaluation here...';
		this.textArea.style.width = '100%';
		this.textArea.style.minHeight = '100px';
		this.textArea.style.padding = '8px';
		this.textArea.style.borderRadius = '4px';
		this.textArea.style.border = '1px solid var(--background-modifier-border)';
		this.textArea.style.backgroundColor = 'var(--background-primary)';
		this.textArea.style.color = 'var(--text-normal)';
		this.textArea.style.fontFamily = 'inherit';
		this.textArea.style.resize = 'vertical';

		this.textArea.addEventListener('input', (e) => {
			this.evaluationText = (e.target as HTMLTextAreaElement).value;
		});
	}

	createButtons(buttonContainer: HTMLElement): void {
		const changeContextButton = this.context.createStyledButton('Change Context', this.context.onChangeContext);
		const jumpButton = this.context.createStyledButton('Jump to Note', this.context.onJumpToNote);
		const doneButton = this.context.createStyledButton('Done', async () => {
			await this.handleDone();
		});
		const nextButton = this.context.createStyledButton('Next', this.context.onNext);

		buttonContainer.appendChild(changeContextButton);
		buttonContainer.appendChild(jumpButton);
		buttonContainer.appendChild(doneButton);
		buttonContainer.appendChild(nextButton);
	}

	private async handleDone(): Promise<void> {
		if (!this.evaluationText.trim()) {
			this.context.showError('Please enter an evaluation before clicking Done.');
			return;
		}

		try {
			// Read the current note content
			const currentContent = await this.context.app.vault.read(this.context.currentNote);
			
			// Add the evaluation as a bullet point at the end
			const evaluationBullet = `- ${this.evaluationText.trim()}`;
			const newContent = currentContent + '\n\n' + evaluationBullet;
			
			// Write back to the note
			await this.context.app.vault.modify(this.context.currentNote, newContent);
			
			// Proceed to next note
			await this.context.onNext();
		} catch (error) {
			console.error('Error saving evaluation to note:', error);
			this.context.showError('Error saving evaluation. Please try again.');
		}
	}

	cleanup(): void {
		this.textArea = null;
		this.evaluationText = '';
	}
}