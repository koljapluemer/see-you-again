import { ActionType } from '../types';

/**
 * Configurable weights for action types
 * Higher numbers = more frequent selection
 * 
 * Example: if 'look-at' = 3 and 'iterate' = 2, then 'look-at' should appear 1.5x as often as 'iterate'
 * 
 * Edit these values to change the frequency of each action type:
 */
export const ACTION_TYPE_WEIGHTS: Record<ActionType, number> = {
  'look-at': 3,
  'iterate': 2,
  'schedule': 1,
  'evaluate': 2,
  'memorize': 3,
};

/**
 * Utility functions for working with action type weights
 */
export class ActionTypeWeightsConfig {
  /**
   * Get the weight for a specific action type
   */
  static getWeight(actionType: ActionType): number {
    return ACTION_TYPE_WEIGHTS[actionType] ?? 1;
  }

  /**
   * Get all action types sorted by weight (highest first)
   */
  static getActionTypesByWeight(): { actionType: ActionType; weight: number }[] {
    return Object.entries(ACTION_TYPE_WEIGHTS)
      .map(([actionType, weight]) => ({ actionType: actionType as ActionType, weight }))
      .sort((a, b) => b.weight - a.weight);
  }

  /**
   * Get the total sum of all weights (for percentage calculations)
   */
  static getTotalWeight(): number {
    return Object.values(ACTION_TYPE_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
  }

  /**
   * Get the expected percentage for an action type based on its weight
   */
  static getExpectedPercentage(actionType: ActionType): number {
    const weight = this.getWeight(actionType);
    const total = this.getTotalWeight();
    return (weight / total) * 100;
  }

  /**
   * Validate that all action types have weights configured
   */
  static validateWeights(): { isValid: boolean; missingTypes: string[] } {
    const allActionTypes: ActionType[] = ['look-at', 'iterate', 'schedule', 'evaluate', 'memorize'];
    const configuredTypes = Object.keys(ACTION_TYPE_WEIGHTS) as ActionType[];

    const missingTypes = allActionTypes.filter(type => !configuredTypes.includes(type));

    return {
      isValid: missingTypes.length === 0,
      missingTypes
    };
  }
}