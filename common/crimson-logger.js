/**
 * Centralized Logging System for LD Crimson Blood
 * Provides consistent logging with debug flag controls
 */

import { MODULE_ID, MODULE_PREFIX } from './constants.js';

class CrimsonLogger  {
  constructor() {
    this._debugEnabled = false;
    this._subsystemDebug = new Map();
    this._initializeFromSettings();
  }

  _initializeFromSettings() {
    // Wait for game to be ready to access settings
    if (typeof game !== 'undefined' && game.settings) {
      try  {
        this._debugEnabled = game.settings.get(MODULE_ID, 'debugMode') ?? false;
      } catch (e) {
        // Settings not registered yet, will use default
      }
    }
  }

  /**
   * Enable or disable debug mode globally
   * @param {boolean} enabled
   */
  setDebugMode(enabled) {
    this._debugEnabled = !!enabled;
    if (typeof game !== 'undefined' && game.settings) {
      try  {
        game.settings.set(MODULE_ID, 'debugMode', this._debugEnabled);
      } catch (e) {
        console.warn(`${MODULE_PREFIX} | Could not save debug setting:`, e);
      }
    }
  }

  /**
   * Enable debug for a specific subsystem
   * @param {string} subsystem - Name of the subsystem (e.g., 'bloodlust', 'crimson-sheet')
   * @param {boolean} enabled
   */
  setSubsystemDebug(subsystem, enabled) {
    this._subsystemDebug.set(subsystem, !!enabled);
  }

  /**
   * Check if debug is enabled for a subsystem
   * @param {string} subsystem
   * @returns {boolean}
   */
  isDebugEnabled(subsystem = null) {
    if (subsystem && this._subsystemDebug.has(subsystem)) {
      return this._subsystemDebug.get(subsystem);
    }
    return this._debugEnabled;
  }

  /**
   * Log an informational message
   * @param {string} subsystem - Subsystem name
   * @param {...any} args - Message and additional data
   */
  log(subsystem, ...args) {
    console.log(`${MODULE_PREFIX} | ${subsystem} |`, ...args);
  }

  /**
   * Log a debug message (only if debug mode enabled)
   * @param {string} subsystem - Subsystem name
   * @param {...any} args - Message and additional data
   */
  debug(subsystem, ...args) {
    if (this.isDebugEnabled(subsystem)) {
      console.log(`${MODULE_PREFIX} | ${subsystem} | [DEBUG] |`, ...args);
    }
  }

  /**
   * Log a warning message
   * @param {string} subsystem - Subsystem name
   * @param {...any} args - Message and additional data
   */
  warn(subsystem, ...args) {
    console.warn(`${MODULE_PREFIX} | ${subsystem} |`, ...args);
  }

  /**
   * Log an error message
   * @param {string} subsystem - Subsystem name
   * @param {...any} args - Message and additional data
   */
  error(subsystem, ...args) {
    console.error(`${MODULE_PREFIX} | ${subsystem} |`, ...args);
  }

  /**
   * Log initialization message
   * @param {string} subsystem - Subsystem name
   */
  init(subsystem) {
    this.log(subsystem, 'Initializing...');
  }

  /**
   * Log ready message
   * @param {string} subsystem - Subsystem name
   */
  ready(subsystem) {
    this.log(subsystem, 'Ready');
  }

  /**
   * Register debug setting with Foundry
   */
  static registerSettings() {
    game.settings.register(MODULE_ID, 'debugMode',  {
      name: 'Debug Mode',
      hint: 'Enable detailed console logging for troubleshooting. Warning: This will generate many console messages.',
      scope: 'client',
      config: true,
      type: Boolean,
      default: false,
      onChange: value =>  {
        if (game[MODULE_ID]?.logger) {
          game[MODULE_ID].logger.setDebugMode(value);
        }
      }
    });
  }
}

// Create singleton instance
const logger = new CrimsonLogger();

// Export for use throughout the module
export { logger, CrimsonLogger };

// Expose globally for console access
if (typeof game !== 'undefined') {
  Hooks.once('init', () =>  {
    game[MODULE_ID] = game[MODULE_ID] || {};
    game[MODULE_ID].logger = logger;
  });
}

