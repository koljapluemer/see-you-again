import { BaseActionHandler } from './baseActionHandler';

export class IterateActionHandler extends BaseActionHandler {
	getPromptText(): string {
		return 'Make some progress with this';
	}
}