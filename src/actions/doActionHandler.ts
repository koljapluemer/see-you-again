import { BaseActionHandler } from './baseActionHandler';

export class DoActionHandler extends BaseActionHandler {
	getPromptText(): string {
		return 'Do this';
	}
}