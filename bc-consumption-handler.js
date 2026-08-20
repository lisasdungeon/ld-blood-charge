/**
 * bc-consumption-handler.js
 * LD Blood Charge - DnD5e Consumption Integration
 * 
 * Handles bloodCharge consumption for DnD5e activities.
 * This works around DnD5e's attribute consumption which only supports system attributes.
 */

import { MODULE_ID } from './bc-constants.js';
import { spendBloodCharges } from './bc-core-operations.js';
import { getBloodCharges } from './bc-actor-utils.js';
import { ensureActorBloodChargeFlags } from './bc-attribute-migration.js';

const BLOOD_CHARGE_PATH = `flags.${MODULE_ID}.bloodCharge`;
const LEGACY_PATHS = [
    'flags.ragnaroks-crimson-blood.bloodCharge',
    'flags.ragnarok-crimson-blood.bloodCharge'
];

/**
 * Check if a consumption target is for blood charge
 * @param {string} targetPath - The consumption target path
 * @returns {boolean}
 */
function isBloodChargeTarget(targetPath) {
    if (!targetPath) return false;
    if (targetPath === BLOOD_CHARGE_PATH) return true;
    return LEGACY_PATHS.some(path => targetPath.includes(path));
}

/**
 * Get the blood charge cost from activity consumption targets
 * @param {Activity} activity - The activity being used
 * @returns {number|null} The blood charge cost, or null if not a blood charge activity
 */
function getBloodChargeCost(activity) {
    const targets = activity?.consumption?.targets || [];
    for (const target of targets) {
        if (target.type === 'attribute' && isBloodChargeTarget(target.target)) {
            // Parse the value - it could be a number or formula
            const value = parseInt(target.value) || 1;
            return value;
        }
    }
    return null;
}

/**
 * Hook handler for dnd5e.preUseActivity
 * Intercepts blood charge consumption before DnD5e tries to resolve it
 * 
 * @param {Activity} activity - The activity being used
 * @param {object} usageConfig - The usage configuration
 * @param {object} options - Additional options
 * @returns {boolean|void} Return false to prevent the activity use
 */
export async function handlePreUseActivity(activity, usageConfig, options) {
    const item = activity?.item;
    const actor = item?.actor;
    
    if (!actor) return;
    
    // Ensure blood charge flags exist
    await ensureActorBloodChargeFlags(actor);
    
    // Check if this activity consumes blood charge
    const bloodChargeCost = getBloodChargeCost(activity);
    if (bloodChargeCost === null) return;
    
    console.log(`Blood Charge | Activity "${activity.name}" on "${item.name}" requires ${bloodChargeCost} blood charge`);
    
    // Get current blood charge
    const currentCharge = getBloodCharges(actor);
    
    if (currentCharge < bloodChargeCost) {
        ui.notifications.warn(`${actor.name} needs ${bloodChargeCost} Blood Charge but only has ${currentCharge}.`);
        return false; // Prevent activity use
    }
    
    // Mark that we're handling blood charge consumption
    // This prevents DnD5e from trying to consume it (and failing)
    options._bloodChargeHandled = true;
    options._bloodChargeCost = bloodChargeCost;
    
    // Remove blood charge from the consumption targets so DnD5e doesn't try to process it
    const targets = activity.consumption?.targets || [];
    const filteredIndices = [];
    targets.forEach((target, index) => {
        if (target.type === 'attribute' && isBloodChargeTarget(target.target)) {
            filteredIndices.push(index);
        }
    });
    
    // If consume.resources is an array, filter out blood charge indices
    if (Array.isArray(usageConfig.consume?.resources)) {
        usageConfig.consume.resources = usageConfig.consume.resources.filter(
            idx => !filteredIndices.includes(idx)
        );
    }
}

/**
 * Hook handler for dnd5e.useActivity
 * Actually deducts blood charge after successful activity use
 * 
 * @param {Activity} activity - The activity that was used
 * @param {object} usageConfig - The usage configuration
 * @param {object} results - The results of the activity use
 * @param {object} options - Additional options
 */
export async function handleUseActivity(activity, usageConfig, results, options) {
    // Only process if we handled blood charge in preUse
    if (!options._bloodChargeHandled) return;
    
    const item = activity?.item;
    const actor = item?.actor;
    const cost = options._bloodChargeCost;
    
    if (!actor || !cost) return;
    
    // Deduct blood charge
    const success = await spendBloodCharges(actor, cost, `${item.name}: ${activity.name}`, 'Activity');
    
    if (success) {
        console.log(`Blood Charge | Consumed ${cost} blood charge for ${activity.name}`);
    } else {
        console.error(`Blood Charge | Failed to consume blood charge for ${activity.name}`);
    }
}

/**
 * Register consumption hooks for DnD5e integration
 */
export function registerConsumptionHooks() {
    // Pre-use: Check if we can afford blood charge and mark for handling
    Hooks.on('dnd5e.preUseActivity', handlePreUseActivity);
    
    // Post-use: Actually deduct blood charge after successful use
    Hooks.on('dnd5e.useActivity', handleUseActivity);
    
    console.log('Blood Charge | Consumption hooks registered (preUseActivity + useActivity)');
}
