/**
 * bc-attribute-migration.js
 * LD Blood Charge - Attribute Path Migration
 * 
 * Fixes items that reference the wrong module ID in their consumption configuration.
 * Migrates legacy module IDs to "rnk-crimson-blood" in item attributes.
 */

import { MODULE_ID } from './bc-constants.js';

const LEGACY_MODULE_IDS = ['ragnaroks-crimson-blood', 'ragnarok-crimson-blood'];
const CORRECT_BLOOD_CHARGE_PATH = `flags.${MODULE_ID}.bloodCharge`;
const CORRECT_BLOOD_CHARGE_MAX_PATH = `flags.${MODULE_ID}.bloodChargeMax`;

/**
 * Ensure an actor has bloodCharge flags initialized
 * @param {Actor} actor - The actor to check
 * @returns {Promise<void>}
 */
export async function ensureActorBloodChargeFlags(actor) {
    if (!actor) return;
    
    const currentCharge = actor.getFlag(MODULE_ID, 'bloodCharge');
    if (currentCharge === undefined || currentCharge === null) {
        console.log(`Blood Charge | Initializing bloodCharge for ${actor.name} to 0`);
        await actor.setFlag(MODULE_ID, 'bloodCharge', 0);
    }
    
    const maxCharge = actor.getFlag(MODULE_ID, 'bloodChargeMax');
    if (maxCharge === undefined || maxCharge === null) {
        let defaultMax = 10;
        if (game?.settings?.settings?.has(`${MODULE_ID}.bloodChargeMax`)) {
            try {
                defaultMax = game.settings.get(MODULE_ID, 'bloodChargeMax') ?? 10;
            } catch (e) {
                // guard
            }
        }
        console.log(`Blood Charge | Initializing bloodChargeMax for ${actor.name} to ${defaultMax}`);
        await actor.setFlag(MODULE_ID, 'bloodChargeMax', defaultMax);
    }
}

/**
 * Check if an item has incorrect blood charge attribute paths
 * @param {Item} item - The item to check
 * @returns {boolean} True if the item needs migration
 */
function itemNeedsMigration(item) {
    if (!item?.system) return false;
    
    // Check all activities for consumption with legacy module IDs
    const activities = item.system.activities || {};
    for (const activity of Object.values(activities)) {
        if (!activity?.consumption?.targets) continue;
        
        for (const target of activity.consumption.targets) {
            if (!target?.target) continue;
            
            // Check if target references legacy module ID
            for (const legacyId of LEGACY_MODULE_IDS) {
                if (target.target.includes(`flags.${legacyId}.bloodCharge`)) {
                    return true;
                }
            }
        }
    }
    
    return false;
}

/**
 * Migrate an item's blood charge attribute paths
 * @param {Item} item - The item to migrate
 * @returns {Promise<boolean>} True if migration was successful
 */
export async function migrateItemBloodChargePaths(item) {
    if (!item?.system) return false;
    
    let needsUpdate = false;
    const updates = {};
    
    // Migrate activities
    const activities = item.system.activities || {};
    for (const [activityId, activity] of Object.entries(activities)) {
        if (!activity?.consumption?.targets) continue;
        
        activity.consumption.targets.forEach((target, index) => {
            if (!target?.target) return;
            
            // Replace legacy module IDs with correct one
            let newTarget = target.target;
            for (const legacyId of LEGACY_MODULE_IDS) {
                const legacyPath = `flags.${legacyId}.bloodCharge`;
                if (newTarget.includes(legacyPath)) {
                    newTarget = newTarget.replace(legacyPath, CORRECT_BLOOD_CHARGE_PATH);
                    updates[`system.activities.${activityId}.consumption.targets.${index}.target`] = newTarget;
                    needsUpdate = true;
                    console.log(`Blood Charge | Migrating item "${item.name}" activity "${activityId}" from ${legacyPath} to ${CORRECT_BLOOD_CHARGE_PATH}`);
                }
            }
        });
    }
    
    if (needsUpdate) {
        try {
            await item.update(updates);
            ui.notifications.info(`Migrated Blood Charge paths for: ${item.name}`);
            return true;
        } catch (error) {
            console.error(`Blood Charge | Failed to migrate item ${item.name}:`, error);
            ui.notifications.error(`Failed to migrate: ${item.name}`);
            return false;
        }
    }
    
    return false;
}

/**
 * Migrate all items in the world that need blood charge path fixes
 * @param {boolean} dryRun - If true, only report what would be migrated
 * @returns {Promise<number>} Number of items migrated
 */
export async function migrateAllItems(dryRun = false) {
    if (!game.user.isGM) {
        ui.notifications.warn("Only GMs can run item migration");
        return 0;
    }
    
    let count = 0;
    const itemsToMigrate = [];
    
    // Check all actors' items
    for (const actor of game.actors) {
        for (const item of actor.items) {
            if (itemNeedsMigration(item)) {
                itemsToMigrate.push({ item, location: `Actor: ${actor.name}` });
            }
        }
    }
    
    // Check unlinked items in world
    for (const item of game.items) {
        if (itemNeedsMigration(item)) {
            itemsToMigrate.push({ item, location: 'World Items' });
        }
    }
    
    if (itemsToMigrate.length === 0) {
        ui.notifications.info("No items need blood charge path migration");
        return 0;
    }
    
    if (dryRun) {
        console.log("Blood Charge | Items that need migration:");
        itemsToMigrate.forEach(({ item, location }) => {
            console.log(`  - ${item.name} (${location})`);
        });
        ui.notifications.info(`Found ${itemsToMigrate.length} items that need migration (dry run)`);
        return itemsToMigrate.length;
    }
    
    // Perform migration
    for (const { item, location } of itemsToMigrate) {
        const success = await migrateItemBloodChargePaths(item);
        if (success) {
            console.log(`Blood Charge | Migrated: ${item.name} (${location})`);
            count++;
        }
    }
    
    ui.notifications.info(`Migrated ${count} of ${itemsToMigrate.length} items`);
    return count;
}

/**
 * Hook to intercept item use and fix legacy paths on-the-fly
 * Also ensures actor has bloodCharge initialized before consumption check
 * @param {Item} item - The item being used
 * @param {Object} config - The use configuration
 * @param {Object} options - Use options
 */
export async function interceptItemUse(item, config, options) {
    const actor = item?.actor;
    
    // CRITICAL: Ensure actor has bloodCharge initialized before any consumption check
    if (actor) {
        await ensureActorBloodChargeFlags(actor);
    }
    
    // Check if any activity has legacy blood charge consumption
    const activities = item?.system?.activities || {};
    let needsFixing = false;
    const updates = {};
    
    for (const [activityId, activity] of Object.entries(activities)) {
        if (!activity?.consumption?.targets) continue;
        
        activity.consumption.targets.forEach((target, index) => {
            if (!target?.target) return;
            
            // Check for legacy module IDs and fix them in the config object directly
            for (const legacyId of LEGACY_MODULE_IDS) {
                const legacyPath = `flags.${legacyId}.bloodCharge`;
                if (target.target.includes(legacyPath)) {
                    console.warn(`Blood Charge | Intercepting item use: "${item.name}" has legacy path ${legacyPath}, fixing now...`);
                    
                    // Fix it in the target object being used RIGHT NOW
                    target.target = target.target.replace(legacyPath, CORRECT_BLOOD_CHARGE_PATH);
                    
                    // Also queue an update to fix it permanently
                    updates[`system.activities.${activityId}.consumption.targets.${index}.target`] = CORRECT_BLOOD_CHARGE_PATH;
                    needsFixing = true;
                }
            }
        });
    }
    
    // If we fixed anything, update the item permanently in the background
    if (needsFixing && Object.keys(updates).length > 0) {
        // Don't await - let the item use continue with the fixed config
        item.update(updates).then(() => {
            console.log(`Blood Charge | Permanently fixed item "${item.name}"`);
            ui.notifications.info(`Fixed blood charge path for: ${item.name}`);
        }).catch(error => {
            console.error(`Blood Charge | Failed to permanently fix item "${item.name}":`, error);
        });
    }
}

/**
 * Register the migration hooks
 */
export function registerMigrationHooks() {
    // Hook before item use to fix legacy paths AND ensure flags exist
    Hooks.on('dnd5e.preUseItem', interceptItemUse);
    
    // Also hook on preUseActivity for individual activities
    Hooks.on('dnd5e.preUseActivity', async (activity, usageConfig, options) => {
        const item = activity?.item;
        if (!item) return;
        
        const actor = item.actor;
        
        // CRITICAL: Ensure actor has bloodCharge initialized before consumption check
        if (actor) {
            await ensureActorBloodChargeFlags(actor);
        }
        
        // Fix the activity's consumption targets if they have legacy paths
        const targets = activity?.consumption?.targets;
        if (!targets) return;
        
        let needsUpdate = false;
        const updates = {};
        
        targets.forEach((target, index) => {
            if (!target?.target) return;
            
            for (const legacyId of LEGACY_MODULE_IDS) {
                const legacyPath = `flags.${legacyId}.bloodCharge`;
                if (target.target.includes(legacyPath)) {
                    console.warn(`Blood Charge | Fixing activity consumption path for "${item.name}"`);
                    
                    // Fix it in the target object directly for current use
                    target.target = CORRECT_BLOOD_CHARGE_PATH;
                    
                    // Queue permanent update
                    const activityId = activity.id;
                    updates[`system.activities.${activityId}.consumption.targets.${index}.target`] = CORRECT_BLOOD_CHARGE_PATH;
                    needsUpdate = true;
                }
            }
        });
        
        // Update item permanently in background
        if (needsUpdate && Object.keys(updates).length > 0) {
            item.update(updates).catch(err => console.error('Blood Charge | Update failed:', err));
        }
    });
    
    console.log('Blood Charge | Migration hooks registered (preUseItem + preUseActivity)');
}

/**
 * Add GM commands to manually trigger migration
 */
export function registerMigrationCommands() {
    if (!game.user.isGM) return;
    
    game.rnkCrimsonBlood = game.rnkCrimsonBlood || {};
    
    game.rnkCrimsonBlood.migrateBloodChargeItems = async (dryRun = false) => {
        return await migrateAllItems(dryRun);
    };
    
    game.rnkCrimsonBlood.initializeAllActorBloodCharges = async () => {
        let count = 0;
        for (const actor of game.actors) {
            if (actor.hasPlayerOwner || actor.type === 'character') {
                await ensureActorBloodChargeFlags(actor);
                count++;
            }
        }
        ui.notifications.info(`Initialized blood charge flags for ${count} actors`);
        return count;
    };
    
    // Debug command to inspect all items with bloodCharge consumption
    game.rnkCrimsonBlood.debugBloodChargeItems = () => {
        console.log('=== Blood Charge Debug: Items with bloodCharge consumption ===');
        let found = 0;
        
        for (const actor of game.actors) {
            for (const item of actor.items) {
                const activities = item.system?.activities || {};
                for (const [actId, activity] of Object.entries(activities)) {
                    const targets = activity?.consumption?.targets || [];
                    for (const target of targets) {
                        if (target?.target?.includes('bloodCharge')) {
                            console.log(`Actor: ${actor.name}, Item: ${item.name}, Activity: ${actId}`);
                            console.log(`  Target path: ${target.target}`);
                            console.log(`  Type: ${target.type}`);
                            found++;
                        }
                    }
                }
            }
        }
        
        for (const item of game.items) {
            const activities = item.system?.activities || {};
            for (const [actId, activity] of Object.entries(activities)) {
                const targets = activity?.consumption?.targets || [];
                for (const target of targets) {
                    if (target?.target?.includes('bloodCharge')) {
                        console.log(`World Item: ${item.name}, Activity: ${actId}`);
                        console.log(`  Target path: ${target.target}`);
                        console.log(`  Type: ${target.type}`);
                        found++;
                    }
                }
            }
        }
        
        console.log(`=== Found ${found} items with bloodCharge consumption ===`);
        return found;
    };
    
    console.log('Blood Charge | Migration commands registered:');
    console.log('  - game.rnkCrimsonBlood.migrateBloodChargeItems(dryRun)');
    console.log('  - game.rnkCrimsonBlood.initializeAllActorBloodCharges()');
    console.log('  - game.rnkCrimsonBlood.debugBloodChargeItems()');
}
