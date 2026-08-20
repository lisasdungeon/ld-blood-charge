/**
 * bc-actor-utils.js
 * LD Blood Charge - Actor Utilities
 * 
 * Provides utility functions for getting and checking actor blood charge state.
 */

import { MODULE_ID } from './bc-constants.js';

/**
 * Get the current Blood Charge value for an actor.
 * @param {Actor} actor - The actor
 * @returns {number} current blood charge (returns 0 if not set)
 */
export function getBloodCharges(actor) {
  if (!actor) return 0;
  return actor.getFlag(MODULE_ID, 'bloodCharge') || 0;
}

/**
 * Get the maximum Blood Charge for an actor.
 * Checks the actor flag first; if not set, falls back to the world setting; final fallback = 10.
 * @param {Actor} actor - The actor
 * @returns {Promise<Number>} max blood charge
 */
export async function getActorBloodChargeMax(actor) {
  let settingDefault = 10;
  if (game?.settings?.settings?.has(`${MODULE_ID}.bloodChargeMax`)) {
    try { settingDefault = game.settings.get(MODULE_ID, 'bloodChargeMax') ?? 10; } catch { /* guard */ }
  }
  if (!actor) return settingDefault;
  try {
    const flagValue = actor.getFlag(MODULE_ID, 'bloodChargeMax');
    if (flagValue !== undefined && flagValue !== null) return Number(flagValue);
  } catch (e) {
    if (typeof logger !== 'undefined') {
      logger.warn('Blood Charge', `Error reading flag bloodChargeMax for ${actor?.name || 'unknown'}:`, e);
    }
  }
  return settingDefault;
}

/**
 * Check if an actor has enough blood charges for an ability
 * @param {Actor} actor - The actor to check
 * @param {number} requiredAmount - Required amount of charges
 * @returns {Promise<boolean>} True if the actor has enough charges
 */
export async function hasEnoughBloodCharges(actor, requiredAmount) {
  if (!actor || requiredAmount <= 0) return false;
  const currentCharge = actor.getFlag(MODULE_ID, 'bloodCharge') || 0;
  return currentCharge >= requiredAmount;
}
