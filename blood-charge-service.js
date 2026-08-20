import  {
  MODULE_ID,
  BloodChargeGMHub,
  getActorBloodChargeMax,
  spendBloodCharges,
  grantBloodCharges,
  hasEnoughBloodCharges,
  getChargeHistory,
  getChargeAnalytics,
  regenerateCharges,
  decayCharges,
  onDamageTaken,
  onAbilityUsed
} from './blood-charge-core.js';
import { safeRegisterSetting } from './common/settings-registry.js';
import { registerMigrationHooks, registerMigrationCommands, migrateAllItems } from './bc-attribute-migration.js';
import { registerConsumptionHooks } from './bc-consumption-handler.js';
import { _registerSocketListener } from './bc-service-socket.js';
import { _registerSceneControlButton, _registerDamageHooks } from './bc-service-controls.js';

const TEMPLATE_BASE = `modules/${MODULE_ID}/blood-charge-templates/`;
const TEMPLATE_FILES = [
  `${TEMPLATE_BASE}blood-charge-gm-hub.html`,
  `${TEMPLATE_BASE}blood-charge-player-tab.html`,
  `${TEMPLATE_BASE}blood-charge-pc-widget.html`
];
const PARTIALS =  {
  'blood-charge-player-tab': `${TEMPLATE_BASE}blood-charge-player-tab.html`,
  'blood-charge-charge-display': `${TEMPLATE_BASE}blood-charge-charge-display.html`
};
const SETTING_KEY = 'bloodChargeMax';
const DEFAULT_MAX = 10;

class BloodChargeService  {
  constructor() {
    this._initialized = false;
    this._ready = false;
    this._helpersRegistered = false;
    this._socketRegistered = false;
    this._socketHandler = null;
    this._gmHub = null;
    this._templatesLoaded = false;
    this._templateRetryScheduled = false;
  }

  async onInit() {
    if (this._initialized) return;
    this._registerHandlebarsHelpers();
    this._registerSetting();
    this._registerShutdownListener();
    this._registerSceneControlButton();
    this._initialized = true;
  }

  onSetup() {
    this._setupRan = true;
  }

  async onReady() {
    if (this._ready) return;
    await this._loadTemplates();
    this._ensureNamespace();
    this._registerApi();
    this._registerSocketListener();
    this._defineGlobalPaths();
    await this._migrateActorFlags();
    registerMigrationHooks();
    registerMigrationCommands();
    registerConsumptionHooks();
    await this._migrateItemAttributes();
    await this._ensureGMHub();
    this._registerSceneControlButton();
    this._registerDamageHooks();

    // Force a render of scene controls to ensure our button is present.
    if (ui?.controls) {
      ui.controls.render();
    }

    this._fixStylesheetUrls();
    this._ready = true;
  }

  /**
   * Fix malformed stylesheet URLs caused by incorrect quotes being inserted.
   * Some environments end up loading CSS with hrefs like "%22modules/..." which fails.
   * This method corrects those hrefs at runtime.
   * @private
   */
  _fixStylesheetUrls() {
    if (typeof document === 'undefined') return;
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    for (const link of links) {
      const href = link.getAttribute('href');
      if (!href) continue;
      // Fix cases where the URL begins with an encoded quote (%22) or literal quote
      if (href.startsWith('%22') || href.startsWith('"')) {
        const fixed = href.replace(/^(%22|\")+/, '');
        link.setAttribute('href', fixed);
        console.log('Blood Charge | Fixed malformed stylesheet URL:', href, '→', fixed);
      }
    }
  }

  async teardown() {
    if (this._socketRegistered && game?.socket && this._socketHandler) {
      try  {
        game.socket.off(`module.${MODULE_ID}`, this._socketHandler);
      } catch (error) {
        console.warn('Blood Charge | Failed to remove socket listener', error);
      }
    }
    this._socketRegistered = false;
    this._socketHandler = null;

    if (this._sceneControlObserver) {
      try {
        this._sceneControlObserver.disconnect();
      } catch {
        /* ignore */
      }
      this._sceneControlObserver = null;
    }
  }

  _registerHandlebarsHelpers() {
    if (this._helpersRegistered) return;
    this._helpersRegistered = true;

    Handlebars.registerHelper('enrich', function (text) {
      const editor = foundry?.utils?.TextEditor ?? foundry?.applications?.ux?.TextEditor?.implementation ?? TextEditor;
      return new Handlebars.SafeString(editor?.enrichHTML(text) ?? text);
    });

    Handlebars.registerHelper('formatTime', function (timestamp) {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString();
    });

    Handlebars.registerHelper('gt', function (a, b) {
      return a > b;
    });

    console.log('Blood Charge | Handlebars helpers registered.');
  }

  async _loadTemplates() {
    if (this._templatesLoaded) return;

    const handlebars = await this._waitForHandlebars();
    if (!handlebars) {
      if (!this._templateRetryScheduled && typeof Hooks?.once === 'function') {
        this._templateRetryScheduled = true;
        Hooks.once('ready', () => this._loadTemplates());
      }
      console.warn('Blood Charge | Handlebars renderer is not available yet. Will retry when Foundry is ready.');
      return;
    }

    try  {
      await handlebars.loadTemplates(TEMPLATE_FILES);
      for (const [name, path] of Object.entries(PARTIALS)) {
        const template = await handlebars.getTemplate(path);
        if (template) {
          Handlebars.registerPartial(name, template);
        } else  {
          console.warn(`Blood Charge | Failed to load partial template: ${name} from ${path}`);
        }
      }
      console.log('Blood Charge | Templates and partials registered successfully.');
      this._templatesLoaded = true;
    } catch (error) {
      console.error('Blood Charge | Failed to load templates:', error);
    }
  }

  async _waitForHandlebars(timeoutMs = 10000) {
    const start = Date.now();
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    while (Date.now() - start < timeoutMs) {
      const handlebars = foundry?.applications?.handlebars;
      if (handlebars?.loadTemplates && typeof handlebars.loadTemplates === 'function' && typeof handlebars.getTemplate === 'function') {
        return handlebars;
      }
      await delay(100);
    }
    return null;
  }

  _registerSetting() {
    const registered = safeRegisterSetting(MODULE_ID, SETTING_KEY,  {
      name: 'LD.BloodCharge.Settings.BloodChargeMax',
      hint: 'LD.BloodCharge.Settings.BloodChargeMaxHint',
      scope: 'world',
      config: true,
      type: Number,
      default: DEFAULT_MAX
    });
    if (registered) {
      console.log('Blood Charge | Registered setting bloodChargeMax.');
    } else  {
      console.log('Blood Charge | Queued bloodChargeMax setting until settings become available.');
    }
  }

  _registerShutdownListener() {
    if (typeof Hooks?.once !== 'function') return;
    Hooks.once('shutdown', () => this.teardown());
  }

  _ensureNamespace() {
    if (!game) return;
    game[MODULE_ID] = game[MODULE_ID] || {};
  }

  _registerApi() {
    if (!game?.[MODULE_ID]) return;
    game[MODULE_ID].BloodCharge =  {
      spendCharges: spendBloodCharges,
      grantCharges: grantBloodCharges,
      hasEnoughCharges: hasEnoughBloodCharges,
      getChargeHistory,
      getAnalytics: getChargeAnalytics,
      getMaxCharge: getActorBloodChargeMax,
      onDamageTaken,
      onAbilityUsed,
      regenerateCharges,
      decayCharges
    };
    console.log(`Blood Charge | API registered at game.${MODULE_ID}.BloodCharge`);
  }


  _defineGlobalPaths() {
    if (typeof window === 'undefined') return;
    if (typeof window.BLOOD_CHARGE_DATA_PATHS === 'undefined') {
      window.BLOOD_CHARGE_DATA_PATHS =  {
        currentCharge: `flags.${MODULE_ID}.bloodCharge`,
        maxCharge: `flags.${MODULE_ID}.bloodChargeMax`
      };
      console.log('Blood Charge | window.BLOOD_CHARGE_DATA_PATHS defined.');
    }
  }


  async _migrateItemAttributes() {
    if (!game?.user?.isGM) return;
    try {
      console.log('Blood Charge | Checking for items with legacy attribute paths...');
      const migratedCount = await migrateAllItems(false);
      if (migratedCount > 0) {
        console.log(`Blood Charge | Migrated ${migratedCount} items with legacy attribute paths`);
      }
    } catch (error) {
      console.error('Blood Charge | Error during item attribute migration:', error);
    }
  }

  async _migrateActorFlags() {
    if (!game?.user?.isGM) return;
    try  {
      const worldDefault = game.settings.get(MODULE_ID, SETTING_KEY) ?? DEFAULT_MAX;
      const actorsToUpdate = game.actors.filter((actor) => actor.hasPlayerOwner || actor.type === 'character');
      for (const actor of actorsToUpdate) {
        // Initialize bloodChargeMax if missing
        const existingMax = await actor.getFlag(MODULE_ID, 'bloodChargeMax');
        if (existingMax === undefined || existingMax === null) {
          await actor.setFlag(MODULE_ID, 'bloodChargeMax', worldDefault);
          console.log(`Blood Charge | Set default bloodChargeMax for ${actor.name} to ${worldDefault}`);
        }
        
        // CRITICAL: Initialize bloodCharge if missing (this was the bug!)
        const currentCharge = await actor.getFlag(MODULE_ID, 'bloodCharge');
        if (currentCharge === undefined || currentCharge === null) {
          await actor.setFlag(MODULE_ID, 'bloodCharge', 0);
          console.log(`Blood Charge | Initialized bloodCharge for ${actor.name} to 0`);
        } else if (currentCharge > (existingMax ?? worldDefault)) {
          // Clamp if over max
          await actor.setFlag(MODULE_ID, 'bloodCharge', existingMax ?? worldDefault);
          console.log(`Blood Charge | Clamped ${actor.name}'s currentCharge to ${existingMax ?? worldDefault}`);
        }
      }
      console.log(`Blood Charge | Actor flag migration complete for ${actorsToUpdate.length} actors`);
    } catch (error) {
      console.warn('Blood Charge | Error during actor bloodChargeMax migration:', error);
    }
  }

  async _ensureGMHub() {
    if (!game?.user?.isGM) return;
    if (!game[MODULE_ID]) this._ensureNamespace();
    if (game[MODULE_ID].bloodChargeHub) {
      this._gmHub = game[MODULE_ID].bloodChargeHub;
      console.log('Blood Charge | GM Hub instance already exists.');
      return;
    }

    try  {
      this._gmHub = new BloodChargeGMHub();
      game[MODULE_ID].bloodChargeHub = this._gmHub;
      console.log('Blood Charge | GM Hub instance created and exposed.');
    } catch (error) {
      console.error('Blood Charge | Failed to instantiate BloodChargeGMHub:', error);
    }
  }
}

BloodChargeService.prototype._registerSocketListener = _registerSocketListener;
BloodChargeService.prototype._registerSceneControlButton = _registerSceneControlButton;
BloodChargeService.prototype._registerDamageHooks = _registerDamageHooks;

export const bloodChargeService = new BloodChargeService();
export { BloodChargeService };
