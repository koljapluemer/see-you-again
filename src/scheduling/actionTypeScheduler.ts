import type { ActionType } from '../types';
import { ActionTypeWeightsConfig } from '../config/actionTypeWeights';

export interface ActionTypeStats {
  actionType: ActionType;
  actualCount: number;
  expectedCount: number;
  expectedPercentage: number;
  actualPercentage: number;
  deficitRatio: number; // How much this action type is underrepresented (higher = more underrepresented)
}

export class ActionTypeScheduler {
  /**
   * Determine which action type is most underpicked based on weights vs actual usage
   */
  static getMostUnderpickedActionType(actionTypeUsage: Record<ActionType, number>): ActionType | null {
    const stats = this.calculateActionTypeStats(actionTypeUsage);
    
    // Sort by deficit ratio (highest first = most underrepresented)
    stats.sort((a, b) => b.deficitRatio - a.deficitRatio);
    
    if (stats.length === 0) {
      return null;
    }
    
    const mostUnderpicked = stats[0];
    
    // Action type selected based on deficit ratio analysis
    
    return mostUnderpicked.actionType;
  }

  /**
   * Calculate detailed statistics for all action types
   */
  static calculateActionTypeStats(actionTypeUsage: Record<ActionType, number>): ActionTypeStats[] {
    const totalActualUsage = Object.values(actionTypeUsage).reduce((sum, count) => sum + count, 0);
    ActionTypeWeightsConfig.getTotalWeight();
    
    // If no notes have been processed yet, all action types are equally underpicked
    // Return them sorted by weight (highest weight first)
    if (totalActualUsage === 0) {
      return ActionTypeWeightsConfig.getActionTypesByWeight().map(({ actionType, weight }) => ({
        actionType,
        actualCount: 0,
        expectedCount: 0,
        expectedPercentage: ActionTypeWeightsConfig.getExpectedPercentage(actionType),
        actualPercentage: 0,
        deficitRatio: weight // Use weight as initial deficit ratio
      }));
    }
    
    const stats: ActionTypeStats[] = [];
    
    for (const [actionType, actualCount] of Object.entries(actionTypeUsage) as [ActionType, number][]) {
      const weight = ActionTypeWeightsConfig.getWeight(actionType);
      const expectedPercentage = ActionTypeWeightsConfig.getExpectedPercentage(actionType);
      const actualPercentage = totalActualUsage > 0 ? (actualCount / totalActualUsage) * 100 : 0;
      const expectedCount = Math.round((expectedPercentage / 100) * totalActualUsage);
      
      // Calculate deficit ratio: how much this action type should appear vs how much it has appeared
      // Higher ratio = more underrepresented
      let deficitRatio: number;
      if (actualCount === 0) {
        // If never selected, deficit is based on weight
        deficitRatio = weight * 10; // Boost unselected items
      } else {
        // Deficit ratio = expected percentage / actual percentage
        // Values > 1 mean underrepresented, values < 1 mean overrepresented
        deficitRatio = expectedPercentage / actualPercentage;
      }
      
      stats.push({
        actionType,
        actualCount,
        expectedCount,
        expectedPercentage,
        actualPercentage,
        deficitRatio
      });
    }
    
    return stats;
  }

  /**
   * Get a summary of current action type distribution for logging/debugging
   */
  static getUsageSummary(actionTypeUsage: Record<ActionType, number>): string {
    const stats = this.calculateActionTypeStats(actionTypeUsage);
    const totalUsage = Object.values(actionTypeUsage).reduce((sum, count) => sum + count, 0);
    
    let summary = `Action Type Usage Summary (Total: ${totalUsage}):\n`;
    
    // Sort by deficit ratio for display
    stats.sort((a, b) => b.deficitRatio - a.deficitRatio);
    
    for (const stat of stats) {
      const status = stat.deficitRatio > 1.2 ? '📉 UNDER' : stat.deficitRatio < 0.8 ? '📈 OVER' : '✅ OK';
      summary += `  ${stat.actionType.padEnd(10)} | ${stat.actualCount.toString().padStart(3)} (${stat.actualPercentage.toFixed(1).padStart(4)}%) | Expected: ${stat.expectedPercentage.toFixed(1).padStart(4)}% | Deficit: ${stat.deficitRatio.toFixed(2).padStart(4)} ${status}\n`;
    }
    
    return summary;
  }
}