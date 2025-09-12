import { BaseActionHandler } from './baseActionHandler';

export class LookAtActionHandler extends BaseActionHandler {
	getPromptText(): string {
		return 'Consider this';
	}
}