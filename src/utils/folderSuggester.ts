import { AbstractInputSuggest, App, TAbstractFile, TFolder } from 'obsidian';

export class FolderSuggest extends AbstractInputSuggest<TFolder> {
	private onSelectCallback?: (value: string) => void;

	constructor(app: App, inputEl: HTMLInputElement, onSelect?: (value: string) => void) {
		super(app, inputEl);
		this.onSelectCallback = onSelect;
	}

	getSuggestions(inputStr: string): TFolder[] {
		const abstractFiles = this.app.vault.getAllLoadedFiles();
		const folders: TFolder[] = [];
		const lowerCaseInputStr = inputStr.toLowerCase();

		abstractFiles.forEach((folder: TAbstractFile) => {
			if (
				folder instanceof TFolder &&
				folder.path.toLowerCase().contains(lowerCaseInputStr)
			) {
				folders.push(folder);
			}
		});

		return folders.slice(0, 50); // Reasonable limit
	}

	renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.createEl('div', { 
			text: folder.path,
			cls: 'folder-suggestion-item'
		});
	}

	selectSuggestion(folder: TFolder): void {
		this.setValue(folder.path);
		if (this.onSelectCallback) {
			this.onSelectCallback(folder.path);
		}
	}
}