/**
 * bc-history-tracking.js
 * LD Blood Charge - History Tracking
 * 
 * Handles blood charge change history tracking and analytics.
 */

import { MODULE_ID } from './bc-constants.js';

/**
 * Track a blood charge change event in history
 * @param {Actor} actor - The actor whose charge changed
 * @param {number} oldValue - The previous charge value
 * @param {number} newValue - The new charge value
 * @param {string} reason - The reason for the change
 * @param {string} source - Who initiated the change (GM, player, automation, etc.)
 */
export async function trackChargeHistory(actor, oldValue, newValue, reason = 'Manual adjustment', source = 'GM') {
  if (!actor) return;

  try {
    const historyEntry = {
      timestamp: Date.now(),
      oldValue: oldValue,
      newValue: newValue,
      delta: newValue - oldValue,
      reason: reason,
      source: source,
      actorId: actor.id,
      actorName: actor.name
    };

    // Get existing history or initialize empty array
    const existingHistory = await actor.getFlag(MODULE_ID, 'chargeHistory') || [];

    // Add new entry and keep only last 100 entries to prevent bloat
    existingHistory.push(historyEntry);
    if (existingHistory.length > 100) {
      existingHistory.shift(); // Remove oldest entry
    }

    await actor.setFlag(MODULE_ID, 'chargeHistory', existingHistory);
  } catch (e) {
    if (typeof logger !== 'undefined') {
      logger.warn('Blood Charge', `Failed to track history for ${actor?.name}:`, e);
    }
  }
}

/**
 * Get charge history for an actor
 * @param {Actor} actor - The actor to get history for
 * @returns {Promise<Array>} Array of history entries
 */
export async function getChargeHistory(actor) {
  if (!actor) return [];
  try {
    return await actor.getFlag(MODULE_ID, 'chargeHistory') || [];
  } catch (e) {
    if (typeof logger !== 'undefined') {
      logger.warn('Blood Charge', `Failed to get history for ${actor?.name}:`, e);
    }
    return [];
  }
}

/**
 * Get charge analytics/statistics
 * @param {Actor} actor - The actor to analyze (optional, if not provided analyzes all players)
 * @returns {Promise<Object>} Analytics data
 */
export async function getChargeAnalytics(actor = null) {
  const actors = actor ? [actor] : game.actors.filter(a => a.hasPlayerOwner);
  const analytics = {
    totalCharges: 0,
    totalChanges: 0,
    averageChange: 0,
    largestGain: 0,
    largestLoss: 0,
    mostActiveActor: null,
    changeReasons: {},
    recentActivity: []
  };

  for (const act of actors) {
    const history = await getChargeHistory(act);
    const currentCharge = await act.getFlag(MODULE_ID, 'bloodCharge') || 0;

    analytics.totalCharges += currentCharge;
    analytics.totalChanges += history.length;

    if (history.length > 0) {
      const changes = history.map(h => h.delta);
      const gains = changes.filter(c => c > 0);
      const losses = changes.filter(c => c < 0);

      if (gains.length > 0) {
        analytics.largestGain = Math.max(analytics.largestGain, Math.max(...gains));
      }
      if (losses.length > 0) {
        analytics.largestLoss = Math.min(analytics.largestLoss, Math.min(...losses));
      }

      // Track reasons
      history.forEach(entry => {
        analytics.changeReasons[entry.reason] = (analytics.changeReasons[entry.reason] || 0) + 1;
      });

      // Track most active actor
      if (!analytics.mostActiveActor || history.length > analytics.mostActiveActor.count) {
        analytics.mostActiveActor = { name: act.name, count: history.length };
      }
    }

    // Add recent activity (last 10 entries across all actors)
    analytics.recentActivity.push(...history.slice(-10));
  }

  analytics.recentActivity.sort((a, b) => b.timestamp - a.timestamp);
  analytics.recentActivity = analytics.recentActivity.slice(0, 10);

  if (analytics.totalChanges > 0) {
    analytics.averageChange = analytics.totalChanges / actors.length;
  }

  return analytics;
}
