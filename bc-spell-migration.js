/**
 * bc-spell-migration.js
 * LD Blood Charge - Spell Consumption Migration
 * 
 * Removes invalid activity consumption targets that reference bloodCharge flags.
 * This allows the bc-consumption-handler hooks to work properly without 
 * dnd5e validation errors.
 */

import { MODULE_ID } from './bc-constants.js';

const BLOOD_CHARGE_PATHS = [
    `flags.${MODULE_ID}.bloodCharge`,
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
    return BLOOD_CHARGE_PATHS.some(path => targetPath === path || targetPath.includes(path));
}

/**
 * Migrate a single item to remove invalid blood charge consumption targets
 * @param {Item} item - The item to migrate
 * @returns {Promise<boolean>} Whether the item was updated
 */
async function migrateItemConsumption(item) {
    if (!item.system?.activities) return false;

    let needsUpdate = false;
    const updates = {};

    for (const [activityId, activity] of Object.entries(item.system.activities)) {
        if (!activity.consumption?.targets) continue;

        const originalTargets = [...activity.consumption.targets];
        const filteredTargets = originalTargets.filter(
            target => !(target.type === 'attribute' && isBloodChargeTarget(target.target))
        );

        if (filteredTargets.length < originalTargets.length) {
            updates[`system.activities.${activityId}.consumption.targets`] = filteredTargets;
            needsUpdate = true;
            console.log(`Blood Charge Migration | Removed blood charge target from "${item.name}" activity "${activity.name || activityId}"`);
        }
    }

    if (needsUpdate) {
        await item.update(updates);
        return true;
    }

    return false;
}

/**
 * Run migration on all items in the world
 * @returns {Promise<object>} Migration results
 */
export async function migrateAllSpellConsumption() {
    if (!game.user?.isGM) {
        console.warn('Blood Charge | Only GMs can run spell migration');
        return { skipped: true, reason: 'Non-GM user' };
    }

    console.log('Blood Charge Migration | Starting spell consumption migration...');

    let itemsProcessed = 0;
    let itemsUpdated = 0;
    let errors = 0;

    try {
        // Migrate all items in the world
        for (const item of game.items) {
            itemsProcessed++;
            try {
                if (await migrateItemConsumption(item)) {
                    itemsUpdated++;
                }
            } catch (error) {
                console.error(`Blood Charge Migration | Error migrating item "${item.name}":`, error);
                errors++;
            }
        }

        // Migrate items in all actor inventories
        for (const actor of game.actors) {
            for (const item of actor.items) {
                itemsProcessed++;
                try {
                    if (await migrateItemConsumption(item)) {
                        itemsUpdated++;
                    }
                } catch (error) {
                    console.error(`Blood Charge Migration | Error migrating item "${item.name}" from actor "${actor.name}":`, error);
                    errors++;
                }
            }
        }

        const message = `Blood Charge Migration | Complete! Processed ${itemsProcessed} items, updated ${itemsUpdated}, errors: ${errors}`;
        console.log(message);
        ui.notifications.info(message);

        return {
            success: true,
            itemsProcessed,
            itemsUpdated,
            errors
        };
    } catch (error) {
        console.error('Blood Charge Migration | Fatal error:', error);
        ui.notifications.error('Blood Charge spell migration failed! Check console for details.');
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Register migration as a macro command
 */
export function registerMigrationCommand() {
    if (!window.RNK) window.RNK = {};
    if (!window.RNK.bloodCharge) window.RNK.bloodCharge = {};

    window.RNK.bloodCharge.migrateSpellConsumption = migrateAllSpellConsumption;

    console.log('Blood Charge | Migration command registered: RNK.bloodCharge.migrateSpellConsumption()');
}
