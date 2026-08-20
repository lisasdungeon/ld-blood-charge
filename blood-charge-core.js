/**
 * blood-charge-core.js
 * LD Blood Charge - Core Module Exports
 * 
 * Barrel export file that re-exports all blood charge functionality from modular bc-* files.
 */

// Constants
export { MODULE_ID } from './bc-constants.js';

// Actor utilities
export { getActorBloodChargeMax, hasEnoughBloodCharges, getBloodCharges } from './bc-actor-utils.js';

// Core operations
export { spendBloodCharges, grantBloodCharges } from './bc-core-operations.js';

// History tracking
export { getChargeHistory, getChargeAnalytics, trackChargeHistory } from './bc-history-tracking.js';

// Effects
export { BloodCharge_ShowGlobalImage, BloodCharge_ShowChargeChangeEffect } from './bc-effects.js';

// Event handlers
export { onDamageTaken, onAbilityUsed, regenerateCharges, decayCharges } from './bc-event-handlers.js';

// GM Hub
export { BloodChargeGMHub } from './bc-gm-hub.js';

// DnD5e Consumption Integration
export { registerConsumptionHooks, handlePreUseActivity, handleUseActivity } from './bc-consumption-handler.js';

// Migration
export { registerMigrationHooks, registerMigrationCommands, ensureActorBloodChargeFlags, migrateAllItems } from './bc-attribute-migration.js';
