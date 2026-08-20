/**
 * bc-gm-hub.js
 * LD Blood Charge - GM Hub Application
 * 
 * ApplicationV2 + HandlebarsApplicationMixin for GM blood charge management.
 */

import { MODULE_ID } from './bc-constants.js';
import { getActorBloodChargeMax } from './bc-actor-utils.js';
import { trackChargeHistory, getChargeAnalytics } from './bc-history-tracking.js';
import { BloodCharge_ShowGlobalImage, BloodCharge_ShowChargeChangeEffect } from './bc-effects.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

function localize(key) {
  return game?.i18n?.localize?.(key) ?? key;
}

/**
 * BloodChargeGMHub - Game Master Blood Charge Management Hub
 * Allows GMs to manage player blood charges with real-time tracking.
 */
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export class BloodChargeGMHub extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * @param {Object} options - Application options
   */
  constructor(options = {}) {
    super(options);
    this.players = []; // Will be populated in _prepareContext
    this._actorUpdateHook = null;
  }

  static DEFAULT_OPTIONS = {
    id: "blood-charge-gm-hub",
    tag: 'form',
    window: {
      icon: 'icons/svg/blood.svg',
      title: 'LD Blood Charge',
      resizable: true,
      minimizable: true
    },
    position: {
      width: 750,
      height: 'auto'
    }
  };

  static PARTS = {
    form: { template: `modules/${MODULE_ID}/blood-charge-templates/blood-charge-gm-hub.html` }
  };

  /**
   * Prepare context data for template rendering.
   * @param {Object} options - Render options
   * @returns {Object} Context data for the template
   */
  async _prepareContext(options) {
    // Fetch player actors with owner
    const allPlayers = game.actors.filter(a => a.type === 'character' && a.hasPlayerOwner);
    this.players = [];
    for (const actor of allPlayers) {
      const currentCharge = actor.getFlag(MODULE_ID, 'bloodCharge') ?? 0;
      const maxCharge = await getActorBloodChargeMax(actor);
      this.players.push({
        id: actor.id,
        name: actor.name,
        img: actor.img,
        currentCharge,
        maxCharge
      });
    }

    // Simple split for layout (adjust if needed)
    const midPoint = Math.ceil(this.players.length / 2);
    const playersLeft = this.players.slice(0, midPoint);
    const playersRight = this.players.slice(midPoint);

    return {
      playersLeft: playersLeft,
      playersRight: playersRight,
      globalMax: (() => { try { return game.settings.get(MODULE_ID, 'bloodChargeMax') ?? 10; } catch { return 10; } })(),
      analytics: await getChargeAnalytics()
    };
  }

  /**
   * Handle post-render setup including event listeners.
   * @param {Object} context - Render context
   * @param {Object} options - Render options
   */
  async _onRender(context, options) {
    await super._onRender(context, options);

    // Drop previous DOM listeners
    this._abort?.abort();
    this._abort = new AbortController();
    this._signal = this._abort.signal;

    const html = this.element;
    const signal = this._signal;

    html.querySelector('.close-btn')?.addEventListener('click', () => this.close(), { signal });

    this._setupPlayerControls(html, signal);
    this._setupGlobalControls(html, signal);

    // Single updateActor hook (rebind cleanly)
    if (this._updateHookId) Hooks.off("updateActor", this._updateHookId);
    this._onActorUpdateBound = this._onActorUpdateBound || this._onActorUpdate.bind(this);
    this._updateHookId = Hooks.on("updateActor", this._onActorUpdateBound);

    this.bringToFront?.();
  }

  /**
   * Handle actor update hook.
   * @param {Actor} updatedActor - The updated actor
   * @param {Object} updateData - The update data
   * @private
   */
  _onActorUpdate(updatedActor, updateData) {
    const hasChargeUpdate = foundry.utils?.hasProperty(updateData, `flags.${MODULE_ID}.bloodCharge`);
    if (this.players.some(p => p.id === updatedActor.id) && hasChargeUpdate) {
      console.log(`Blood Charge | Actor ${updatedActor.name} updated. Re-rendering.`);
      this.render({ force: true });
    }
  }

  /**
   * Setup player control event listeners.
   * @param {HTMLElement} html - The rendered HTML
   * @private
   */
  _setupPlayerControls(html, signal) {
    html.querySelectorAll('.bc-player-card[data-player-id]').forEach((el) => {
      const playerId = el.dataset.playerId;
      const actor = game.actors.get(playerId);
      if (!actor) return;

      // Subtract Charge Button
      el.querySelector('button[data-action="subtract-charge"]')?.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        await this._adjustCharge(actor, -1);
      }, { signal });

      el.querySelector('button[data-action="add-charge"]')?.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        await this._adjustCharge(actor, 1);
      }, { signal });

      el.querySelector('input.player-charge-set-value')?.addEventListener('change', async (ev) => {
        ev.stopPropagation();
        const newValue = parseInt(ev.currentTarget.value, 10);
        if (!Number.isNaN(newValue)) {
          await this._setCharge(actor, newValue);
        }
      }, { signal });
    });
  }

  /**
   * Setup global control event listeners.
   * @param {HTMLElement} html - The rendered HTML
   * @private
   */
  _setupGlobalControls(html, signal) {
    const globalValueInput = html.querySelector('input.global-charge-set-value');

    html.querySelector('button[data-action="add-all"]')?.addEventListener('click', async () => {
      await this._adjustAllCharges(1);
    }, { signal });

    html.querySelector('button[data-action="subtract-all"]')?.addEventListener('click', async () => {
      await this._adjustAllCharges(-1);
    }, { signal });

    html.querySelector('button[data-action="set-all"]')?.addEventListener('click', async () => {
      const newValue = parseInt(globalValueInput?.value, 10);
      if (!Number.isNaN(newValue)) {
        await this._setAllCharges(newValue);
      }
    }, { signal });
  }

  /**
   * Adjust charge for a single actor
   * @param {Actor} actor - The actor
   * @param {number} delta - The change amount
   * @param {string} reason - Reason for change
   * @param {string} source - Source of change
   * @private
   */
  async _adjustCharge(actor, delta, reason = 'Manual adjustment', source = 'GM') {
    if (!actor) return;
    const currentCharge = actor.getFlag(MODULE_ID, 'bloodCharge') ?? 0;
    const maxCharge = await getActorBloodChargeMax(actor);
    const newValue = clamp(currentCharge + delta, 0, maxCharge);

    if (newValue !== currentCharge) {
      await trackChargeHistory(actor, currentCharge, newValue, reason, source);
      console.log(`Blood Charge GM Hub | Adjusting charge for ${actor.name} to ${newValue}`);
      // Unregister hook to prevent recursive re-rendering
      Hooks.off("updateActor", this._updateHookId);
      await actor.setFlag(MODULE_ID, 'bloodCharge', newValue);
      // Re-register hook
      this._updateHookId = Hooks.on("updateActor", this._onActorUpdate.bind(this));
      this._playChargeSound(delta);
      this._showChargeChangeEffect(actor, delta, reason);
      // Notify all clients to update their sheets
      if (game.socket) {
        game.socket.emit(`module.${MODULE_ID}`, {
          type: 'BLOOD_CHARGE_UPDATED',
          payload: {
            actorId: actor.id,
            newValue: newValue,
            delta: delta,
            reason: reason
          }
        });
      }
    }
  }

  /**
   * Set charge for a single actor to a specific value
   * @param {Actor} actor - The actor
   * @param {number} value - The target charge value
   * @param {string} reason - Reason for change
   * @param {string} source - Source of change
   * @private
   */
  async _setCharge(actor, value, reason = 'Direct set', source = 'GM') {
    if (!actor) return;
    const currentCharge = actor.getFlag(MODULE_ID, 'bloodCharge') ?? 0;
    const maxCharge = await getActorBloodChargeMax(actor);
    const newValue = clamp(value, 0, maxCharge);

    if (newValue !== currentCharge) {
      await trackChargeHistory(actor, currentCharge, newValue, reason, source);
      console.log(`Blood Charge GM Hub | Setting charge for ${actor.name} to ${newValue}`);
      const delta = newValue - currentCharge;
      // Unregister hook to prevent recursive re-rendering
      Hooks.off("updateActor", this._updateHookId);
      await actor.setFlag(MODULE_ID, 'bloodCharge', newValue);
      // Re-register hook
      this._updateHookId = Hooks.on("updateActor", this._onActorUpdate.bind(this));
      this._playChargeSound(delta);
      // Notify all clients to update their sheets
      if (game.socket) {
        game.socket.emit(`module.${MODULE_ID}`, {
          type: 'BLOOD_CHARGE_UPDATED',
          payload: {
            actorId: actor.id,
            newValue: newValue,
            delta: delta,
            reason: reason
          }
        });
      }
    }
  }

  /**
   * Adjust charge for all players
   * @param {number} delta - The change amount
   * @param {string} reason - Reason for change
   * @param {string} source - Source of change
   * @private
   */
  async _adjustAllCharges(delta, reason = 'Bulk adjustment', source = 'GM') {
    console.log(`Blood Charge GM Hub | Adjusting all charges by ${delta}`);
    for (const player of this.players) {
      const actor = game.actors.get(player.id);
      await this._adjustCharge(actor, delta, reason, source);
    }
    this._playGlobalEffect(delta);
  }

  /**
   * Set charge for all players to a specific value
   * @param {number} value - The target charge value
   * @param {string} reason - Reason for change
   * @param {string} source - Source of change
   * @private
   */
  async _setAllCharges(value, reason = 'Bulk set', source = 'GM') {
    console.log(`Blood Charge GM Hub | Setting all charges to ${value}`);
    let anyChange = false;
    let avgDelta = 0;
    let changeCount = 0;
    const updatedActors = [];

    // Unregister hook to prevent recursive re-rendering
    Hooks.off("updateActor", this._updateHookId);

    for (const player of this.players) {
      const actor = game.actors.get(player.id);
      if (!actor) continue;
      const currentCharge = actor.getFlag(MODULE_ID, 'bloodCharge') ?? 0;
      const maxCharge = await getActorBloodChargeMax(actor);
      const newValue = clamp(value, 0, maxCharge);

      if (newValue !== currentCharge) {
        await trackChargeHistory(actor, currentCharge, newValue, reason, source);
        await actor.setFlag(MODULE_ID, 'bloodCharge', newValue);
        anyChange = true;
        avgDelta += (newValue - currentCharge);
        changeCount++;
        updatedActors.push({ id: actor.id, newValue, reason });
      }
    }

    // Re-register hook
    this._updateHookId = Hooks.on("updateActor", this._onActorUpdate.bind(this));

    if (anyChange) {
      avgDelta = changeCount > 0 ? Math.round(avgDelta / changeCount) : 0;
      this._playChargeSound(avgDelta);
      this._playGlobalEffect(avgDelta);
      // Notify all clients for each updated actor
      if (game.socket) {
        for (const updatedActor of updatedActors) {
          game.socket.emit(`module.${MODULE_ID}`, {
            type: 'BLOOD_CHARGE_UPDATED',
            payload: {
              actorId: updatedActor.id,
              newValue: updatedActor.newValue,
              reason: updatedActor.reason
            }
          });
        }
      }
    }
  }

  /**
   * Play sound effect based on charge change
   * @param {number} delta - The change amount
   * @private
   */
  _playChargeSound(delta) {
    // Ensure delta is a valid number, default to 0 if NaN
    if (!Number.isFinite(delta) || delta === 0) return;
    const soundDir = `modules/${MODULE_ID}/blood-charge-assets/blood-charge-assets-sounds/`;
    const chargeLevel = Math.min(Math.abs(delta), 6);
    const soundIndex = Math.floor(Math.random() * 5) + 1;
    const soundFile = `${soundDir}BC_Gain_${chargeLevel}_${soundIndex}.mp3`;

    console.log(`Blood Charge | Attempting to play sound: ${soundFile}`);
    (function(){
      const AudioAPI = globalThis.foundry?.audio?.AudioHelper ?? globalThis.AudioHelper;
      if (!AudioAPI || typeof AudioAPI.play !== 'function') return;
      try {
        const maybePromise = AudioAPI.play({ src: soundFile, volume: 0.7, autoplay: true, loop: false });
        if (maybePromise && typeof maybePromise.catch === 'function') maybePromise.catch(e => console.warn("BC GM Hub | Audio play failed:", e));
      } catch (e) { console.warn("BC GM Hub | Audio play failed:", e); }
    })();
  }

  /**
   * Trigger global visual effect
   * @param {number} delta - The change amount
   * @private
   */
  _playGlobalEffect(delta) {
    // Ensure delta is a valid number
    if (!Number.isFinite(delta) || delta === 0) return;
    const imageIndex = Math.floor(Math.random() * 30) + 1;
    const imagePath = `modules/${MODULE_ID}/blood-charge-assets/blood-charge-assets-pics/${String(imageIndex).padStart(2, '0')}.png`;

    console.log(`Blood Charge GM Hub | Emitting global image effect: ${imagePath} with delta ${delta}`);
    game.socket.emit(`module.${MODULE_ID}`, {
      action: 'showImageEffect',
      imagePath: imagePath,
      chargeDelta: delta
    });
  }

  /**
   * Show charge change effect for an actor
   * @param {Actor} actor - The actor
   * @param {number} delta - The change amount
   * @param {string} reason - Reason for change
   * @private
   */
  async _showChargeChangeEffect(actor, delta, reason = '') {
    // Ensure delta is a valid number
    if (!actor || !Number.isFinite(delta) || delta === 0) return;

    const effectData = {
      actorId: actor.id,
      delta: delta,
      reason: reason,
      timestamp: Date.now()
    };

    game.socket.emit(`module.${MODULE_ID}`, {
      action: 'showChargeChangeEffect',
      effectData: effectData
    });
  }

  /**
   * Clean up hook on close
   * @param {Object} options - Close options
   */
  async close(options = {}) {
    this._abort?.abort();
    this._abort = null;
    if (this._updateHookId) {
      Hooks.off("updateActor", this._updateHookId);
      this._updateHookId = null;
    }
    return super.close(options);
  }

  async render(options = {}, _options = {}) {
    if (typeof options === 'boolean') options = { force: options, ..._options };
    return super.render(options);
  }

  /**
   * Serialize application state for persistence
   * @returns {Object} Serialized state
   */
  toJSON() {
    return {
      ...super.toJSON(),
      players: this.players
    };
  }
}
