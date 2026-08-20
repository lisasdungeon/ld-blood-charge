/**
 * bc-core-operations.js
 * LD Blood Charge - Core Operations
 * 
 * Handles core blood charge spend/grant operations and automation.
 */

import { MODULE_ID } from './bc-constants.js';
import { trackChargeHistory, getChargeHistory } from './bc-history-tracking.js';
import { getActorBloodChargeMax } from './bc-actor-utils.js';

function localize(key) {
  return game?.i18n?.localize?.(key) ?? key;
}

function format(key, data = {}) {
  return game?.i18n?.format?.(key, data) ?? localize(key);
}

/**
 * Spend blood charges for an ability or effect
 * @param {Actor} actor - The actor spending charges
 * @param {number} amount - Amount of charges to spend
 * @param {string} abilityName - Name of the ability/effect
 * @param {string} source - Source of the spending request
 * @returns {Promise<boolean>} True if spending was successful
 */
export async function spendBloodCharges(actor, amount, abilityName = 'Unknown Ability', source = 'Player') {
  if (!actor || amount <= 0) return false;

  const currentCharge = actor.getFlag(MODULE_ID, 'bloodCharge') || 0;

  if (currentCharge < amount) {
    ui.notifications.warn(format('LD.BloodCharge.Notifications.SpendFailure', {
      actorName: actor.name,
      currentCharge,
      amount
    }));
    return false;
  }

  const newCharge = currentCharge - amount;
  const reason = `Spent for: ${abilityName}`;

  // Track the spending in history
  await trackChargeHistory(actor, currentCharge, newCharge, reason, source);

  // Update the charge
  await actor.setFlag(MODULE_ID, 'bloodCharge', newCharge);

  // Notify other clients that this actor's blood charge changed
  if (game.socket) {
    game.socket.emit(`module.${MODULE_ID}`, {
      type: 'BLOOD_CHARGE_UPDATED',
      payload: {
        actorId: actor.id,
        newValue: newCharge,
        delta: -amount,
        source,
        abilityName
      }
    });
  }

  // Play sound and visual effect
  const hub = game[MODULE_ID]?.bloodChargeHub;
  if (hub) {
    hub._playChargeSound(-amount);
    hub._playGlobalEffect(-amount);
  }

  ui.notifications.info(format('LD.BloodCharge.Notifications.SpendSuccess', {
    actorName: actor.name,
    amount,
    abilityName,
    remaining: newCharge
  }));

  return true;
}

/**
 * Grant blood charges as a reward
 * @param {Actor} actor - The actor receiving charges
 * @param {number} amount - Amount of charges to grant
 * @param {string} reason - Reason for the reward
 * @param {string} source - Source of the reward
 * @returns {Promise<boolean>} True if granting was successful
 */
export async function grantBloodCharges(actor, amount, reason = 'Reward', source = 'GM') {
  if (!actor || amount <= 0) return false;

  const currentCharge = actor.getFlag(MODULE_ID, 'bloodCharge') || 0;
  const maxCharge = await getActorBloodChargeMax(actor);
  const newCharge = Math.min(currentCharge + amount, maxCharge);

  if (newCharge === currentCharge) {
    ui.notifications.warn(format('LD.BloodCharge.Notifications.MaxAlready', {
      actorName: actor.name,
      maxCharge
    }));
    return false;
  }

  // Track the reward in history
  await trackChargeHistory(actor, currentCharge, newCharge, reason, source);

  // Update the charge
  await actor.setFlag(MODULE_ID, 'bloodCharge', newCharge);

  // Notify other clients that this actor's blood charge changed
  if (game.socket) {
    game.socket.emit(`module.${MODULE_ID}`, {
      type: 'BLOOD_CHARGE_UPDATED',
      payload: {
        actorId: actor.id,
        newValue: newCharge,
        delta: amount,
        source,
        reason
      }
    });
  }

  // Play sound and visual effect
  const hub = game[MODULE_ID]?.bloodChargeHub;
  if (hub) {
    hub._playChargeSound(amount);
    hub._playGlobalEffect(amount);
  }

  ui.notifications.info(format('LD.BloodCharge.Notifications.GrantSuccess', {
    actorName: actor.name,
    amount,
    reason,
    total: newCharge
  }));

  return true;
}

/**
 * Automation: Periodic charge regeneration
 * @param {Actor} actor - The actor to regenerate charges for
 * @param {number} amount - Amount to regenerate (default: 1)
 * @param {string} interval - Time interval description
 */
export async function regenerateCharges(actor, amount = 1, interval = 'periodic') {
  if (!actor) return;

  const reason = `Regeneration (${interval})`;
  await grantBloodCharges(actor, amount, reason, 'Automation');
}

/**
 * Automation: Charge decay over time
 * @param {Actor} actor - The actor to decay charges for
 * @param {number} amount - Amount to decay (default: 1)
 * @param {string} reason - Reason for decay
 */
export async function decayCharges(actor, amount = 1, reason = 'Time decay') {
  if (!actor) return;

  await spendBloodCharges(actor, amount, reason, 'Automation');
}
