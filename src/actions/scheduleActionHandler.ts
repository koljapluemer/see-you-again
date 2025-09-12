import { BaseActionHandler } from './baseActionHandler';

export class ScheduleActionHandler extends BaseActionHandler {
	getPromptText(): string {
		return 'Write down when and where you are going to do this';
	}
}