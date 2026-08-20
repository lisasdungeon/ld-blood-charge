/**
 * Centralized Constants for LD Crimson Blood
 * Single source of truth for module-wide constants
 */

/**
 * Module identifier - used throughout the module for settings, flags, and namespacing
 * @constant {string}
 */
export const MODULE_ID = "ld-blood-charge";
export const LEGACY_MODULE_ID = "rnk-blood-charge";

/**
 * Module display name
 * @constant {string}
 */
export const MODULE_NAME = "LD Blood Charge";

/**
 * Module short name for logging
 * @constant {string}
 */
export const MODULE_SHORT = "Blood Charge";

/**
 * Module prefix for console logging
 * @constant {string}
 */
export const MODULE_PREFIX = "[Blood Charge]";

/**
 * Foundry VTT compatibility versions
 * @constant {Object}
 */
export const FOUNDRY_VERSIONS =  {
  minimum: "11",
  verified: "13",
  maximum: "13"
};

/**
 * Supported game system
 * @constant {string}
 */
export const GAME_SYSTEM = "dnd5e";

/**
 * Common flag scopes used across the module
 * @constant {Object}
 */
export const FLAG_SCOPES =  {
  MODULE: MODULE_ID,
  ACTOR: "actor",
  ITEM: "item",
  WORLD: "world",
  CORE: "core"
};

/**
 * Standard window dimensions for Crimson Blood applications
 * @constant {Object}
 */
export const CRIMSON_STANDARD_WINDOW =  {
  width: 980,
  height: 720
};

/**
 * Game namespace for module APIs - reduces global namespace pollution
 * All module APIs should be registered under game[MODULE_ID] instead of window.*
 * @constant {string}
 */
export const GAME_NAMESPACE = MODULE_ID;

/**
 * Asset paths
 * @constant {Object}
 */
export const PATHS =  {
  MODULE_ROOT: `modules/${MODULE_ID}`,
  ASSETS: `modules/${MODULE_ID}/assets`,
  TEMPLATES: `modules/${MODULE_ID}/templates`,
  STYLES: `modules/${MODULE_ID}/styles`,
  SCRIPTS: `modules/${MODULE_ID}/scripts`
};

