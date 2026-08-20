/**
 * bc-event-handlers.js
 * LD Blood Charge - Event Handlers
 * 
 * Handles event-driven blood charge changes (damage, ability use).
 */

import { MODULE_ID } from './bc-constants.js';
import { spendBloodCharges, grantBloodCharges } from './bc-core-operations.js';

function format(key, data = {}) {
  return game?.i18n?.format?.(key, data) ?? key;
}

/**
 * Automation: Grant charges when taking damage
 * @param {Actor} actor - The actor taking damage
 * @param {number} damageAmount - Amount of damage taken
 * @param {string} damageType - Type of damage (optional)
 */
export async function onDamageTaken(actor, damageAmount, damageType = null) {
  if (!actor || damageAmount <= 0) return;

  // Grant 1 charge for every 10 damage taken
  const chargesToGrant = Math.floor(damageAmount / 10);
  if (chargesToGrant > 0) {
    const reason = `Damage taken: ${damageAmount}${damageType ? ` (${damageType})` : ''}`;
    await grantBloodCharges(actor, chargesToGrant, reason, 'Automation');
  }
}

/**
 * Automation: Spend charges when ability is used
 * @param {Actor} actor - The actor using the ability
 * @param {string} abilityName - Name of the ability
 * @param {number} chargeCost - Cost in blood charges (default: 1)
 * @returns {Promise<boolean>} True if ability usage was successful
 */
export async function onAbilityUsed(actor, abilityName, chargeCost = 1) {
  if (!actor) return false;

  const success = await spendBloodCharges(actor, chargeCost, abilityName, 'Automation');
  if (!success) {
    ui.notifications.warn(format('LD.BloodCharge.Notifications.AbilityNotAffordable', {
      actorName: actor.name,
      abilityName,
      chargeCost
    }));
  }
  return success;
}

/**
 * Regenerate blood charges periodically
 * @param {Actor} actor - The actor to regenerate charges for
 * @param {number} amount - Amount of charges to regenerate (default: 1)
 * @param {string} interval - The interval type (periodic, rest, etc.)
 * @returns {Promise<boolean>} True if regeneration was successful
 */
export async function regenerateCharges(actor, amount = 1, interval = 'periodic') {
  if (!actor || amount <= 0) return false;
  const reason = `Regeneration: ${interval}`;
  return await grantBloodCharges(actor, amount, reason, 'Automation');
}

/**
 * Decay blood charges over time
 * @param {Actor} actor - The actor whose charges decay
 * @param {number} amount - Amount of charges to decay (default: 1)
 * @param {string} reason - The reason for decay
 * @returns {Promise<boolean>} True if decay was successful
 */
export async function decayCharges(actor, amount = 1, reason = 'Time decay') {
  if (!actor || amount <= 0) return false;
  return await spendBloodCharges(actor, amount, reason, 'Automation');
}
