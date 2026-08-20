/**
 * Blood Charge scene controls and damage hooks
 */
import { MODULE_ID, BloodChargeGMHub, onDamageTaken } from './blood-charge-core.js';
import { openBloodChargePCWidget } from './blood-charge-templates/blood-charge-pc-widget.js';

function localize(key) {
  return game?.i18n?.localize?.(key) ?? key;
}

export function _registerSceneControlButton() {
  if (this._sceneControlButtonRegistered) return;
  this._sceneControlButtonRegistered = true;

  const toolId = 'ld-blood-charge-hub';

  const openHub = () => {
    try {
      if (game.user.isGM) {
        if (!game[MODULE_ID]) game[MODULE_ID] = {};
        let hub = game[MODULE_ID].bloodChargeHub;
        if (!hub) {
          hub = new BloodChargeGMHub();
          game[MODULE_ID].bloodChargeHub = hub;
        }
        hub.render({ force: true });
      } else {
        openBloodChargePCWidget();
      }
    } catch (error) {
      console.error('Blood Charge | Failed to open hub:', error);
    }
  };

  const tool = {
    name: toolId,
    title: localize('LD.BloodCharge.SceneControlTooltip'),
    icon: 'fas fa-battery-quarter',
    button: true,
    order: 105,
    visible: true,
    onChange: () => openHub()
  };

  const injectInto = (group) => {
    if (!group) return false;
    if (Array.isArray(group.tools)) {
      if (!group.tools.some((t) => t?.name === toolId)) group.tools.push(tool);
      return true;
    }
    if (group.tools && typeof group.tools === 'object') {
      group.tools[toolId] = tool;
      return true;
    }
    return false;
  };

  Hooks.on('getSceneControlButtons', (controls) => {
    if (Array.isArray(controls)) {
      const token = controls.find((c) => c?.name === 'token' || c?.name === 'tokens');
      if (token && injectInto(token)) return;
      if (!controls.some((c) => c?.name === MODULE_ID)) {
        controls.push({
          name: MODULE_ID,
          title: localize('LD.BloodCharge.SceneControlTitle'),
          icon: 'fas fa-battery-quarter',
          layer: 'tokens',
          visible: true,
          tools: [tool]
        });
      }
      return;
    }
    if (controls && typeof controls === 'object') {
      const token = controls.tokens || controls.token;
      if (token && injectInto(token)) return;
      if (!controls[MODULE_ID]) {
        controls[MODULE_ID] = {
          name: MODULE_ID,
          title: localize('LD.BloodCharge.SceneControlTitle'),
          icon: 'fas fa-battery-quarter',
          visible: true,
          tools: { [toolId]: tool }
        };
      }
    }
  });

  Hooks.on('renderSceneControls', () => {
    const styledBtn = document.querySelector(
      `[data-tool="${toolId}"], [data-control="${MODULE_ID}"]`
    );
    if (!styledBtn) return;
    styledBtn.style.setProperty('color', '#cc0000', 'important');
    styledBtn.style.setProperty('text-shadow', '0 0 8px rgba(180, 0, 0, 0.8)', 'important');
  });
}

/**
 * Grant blood charge when characters take damage (opt-in style: always on for PCs).
 */
export function _registerDamageHooks() {
  if (this._damageHooksRegistered) return;
  this._damageHooksRegistered = true;

  // dnd5e v3+/v4
  Hooks.on('dnd5e.damageActor', async (actor, details) => {
    try {
      if (!actor || actor.type !== 'character') return;
      const amount = Math.abs(Number(details?.total ?? details?.value ?? details?.amount ?? 0));
      if (amount > 0) await onDamageTaken(actor, amount, details?.type);
    } catch (e) {
      console.warn('Blood Charge | dnd5e.damageActor handler failed', e);
    }
  });

  // midi-qol optional
  Hooks.on('midi-qol.DamageApplied', async (workflow) => {
    try {
      const targets = workflow?.damageList || workflow?.targets || [];
      for (const t of targets) {
        const actor = t.actor || game.actors.get(t.actorId);
        const amount = Math.abs(Number(t.appliedDamage ?? t.totalDamage ?? t.hpDamage ?? 0));
        if (actor?.type === 'character' && amount > 0) {
          await onDamageTaken(actor, amount);
        }
      }
    } catch (e) {
      console.warn('Blood Charge | midi damage handler failed', e);
    }
  });
}
