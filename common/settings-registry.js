/**
 * LD Settings Registry
 * Centralized registry for all module settings across the LD Crimson Blood ecosystem
 * @author Lisa's Dungeon
 * @version 1.0.0
 */

/**
 * Settings configuration registry
 * Maps module IDs to their settings configurations
 */
export const SETTINGS_REGISTRY = {
  'ld-crimson-theme': {
    enableRandomBackgrounds: {
      name: 'LDCB.Settings.EnableRandomBackgrounds.Name',
      hint: 'LDCB.Settings.EnableRandomBackgrounds.Hint',
      scope: 'client',
      config: true,
      type: Boolean,
      default: true
    }
  }
};

/**
 * Safely register a game setting with error handling
 * @param {string} moduleId - The module ID
 * @param {string} settingName - The setting name
 * @param {Object} settingConfig - The setting configuration
 * @returns {boolean} True if registered successfully, false if game.settings not ready
 */
export function safeRegisterSetting(moduleId, settingName, settingConfig) {
  try {
    if (!game?.settings) {
      console.warn(`Settings registry not available yet for ${moduleId}.${settingName}`);
      // Retry once Foundry is ready
      if (typeof Hooks?.once === 'function') {
        Hooks.once('ready', () => safeRegisterSetting(moduleId, settingName, settingConfig));
      }
      return false;
    }
    game.settings.register(moduleId, settingName, settingConfig);
    return true;
  } catch (err) {
    if (err.message?.includes('already registered')) return true;
    console.error(`Failed to register setting ${moduleId}.${settingName}:`, err);
    return false;
  }
}

/**
 * Register all module settings
 * Call this during the 'init' hook to register all known settings
 */
export function registerAllSettings() {
  for (const [moduleId, settings] of Object.entries(SETTINGS_REGISTRY)) {
    for (const [settingName, settingConfig] of Object.entries(settings)) {
      safeRegisterSetting(moduleId, settingName, settingConfig);
    }
  }
}

/**
 * Get a setting value by module and key
 * @param {string} moduleId - The module ID
 * @param {string} settingKey - The setting key
 * @returns {*} The setting value
 */
export function getSetting(moduleId, settingKey) {
  return game.settings.get(moduleId, settingKey);
}

/**
 * Set a setting value by module and key
 * @param {string} moduleId - The module ID
 * @param {string} settingKey - The setting key
 * @param {*} value - The new value
 * @returns {Promise<*>} Promise that resolves with the new value
 */
export function setSetting(moduleId, settingKey, value) {
  return game.settings.set(moduleId, settingKey, value);
}
