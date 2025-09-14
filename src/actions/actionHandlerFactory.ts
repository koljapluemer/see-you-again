import type { ActionType } from '../types';
import type { ActionHandler, ActionHandlerContext } from './baseActionHandler';
import { LookAtActionHandler } from './lookAtActionHandler';
import { IterateActionHandler } from './iterateActionHandler';
import { ScheduleActionHandler } from './scheduleActionHandler';
import { EvaluateActionHandler } from './evaluateActionHandler';
import { MemorizeActionHandler } from './memorizeActionHandler';

export class ActionHandlerFactory {
	static async createHandler(
		actionType: ActionType | null, 
		context: ActionHandlerContext
	): Promise<ActionHandler> {
		let handler: ActionHandler;

		switch (actionType) {
			case 'look-at':
				handler = new LookAtActionHandler(context);
				break;
			case 'iterate':
				handler = new IterateActionHandler(context);
				break;
			case 'schedule':
				handler = new ScheduleActionHandler(context);
				break;
			case 'evaluate':
				handler = new EvaluateActionHandler(context);
				break;
			case 'memorize':
				handler = new MemorizeActionHandler(context);
				break;
			default:
				// Default to look-at if action type is unknown or null
				handler = new LookAtActionHandler(context);
				break;
		}

		// Initialize the handler if it has an initialize method
		if ('initialize' in handler && typeof handler.initialize === 'function') {
			await handler.initialize();
		}

		return handler;
	}
}