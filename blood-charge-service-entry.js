import { MODULE_ID, BloodChargeGMHub } from './blood-charge-core.js';
import { BloodChargeService, bloodChargeService } from './blood-charge-service.js';
import { handleError, ErrorSeverity } from './common/error-handler.js';
import { migrateLegacyFlags } from "./ld-legacy-migrate.js";

async function initializeActorBloodChargeFlags(actor) {
  if (!game.user.isGM || !actor) return;
  if (!actor.hasPlayerOwner && actor.type !== 'character') return;
  let defaultMax = 10;
  try { defaultMax = game.settings.get(MODULE_ID, 'bloodChargeMax'); } catch { }
  const currentCharge = actor.getFlag(MODULE_ID, 'bloodCharge');
  const maxCharge = actor.getFlag(MODULE_ID, 'bloodChargeMax');
  const updates = {};
  if (currentCharge === undefined || currentCharge === null) {
    updates[`flags.${MODULE_ID}.bloodCharge`] = 0;
  }
  if (maxCharge === undefined || maxCharge === null) {
    updates[`flags.${MODULE_ID}.bloodChargeMax`] = defaultMax;
  }
  if (Object.keys(updates).length > 0) {
    await actor.update(updates);
  }
}

Hooks.once('init', () =>  {
  bloodChargeService.onInit().catch((error) => handleError(error,  {
    context: 'Blood Charge initialization',
    severity: ErrorSeverity.CRITICAL
  }));
});

Hooks.once('setup', () =>  {
  bloodChargeService.onSetup();
});

Hooks.once('ready', async () =>  {
  migrateLegacyFlags("ld-blood-charge", "rnk-blood-charge").catch(() => {});

  try {
    await bloodChargeService.onReady();
    Hooks.on('createActor', (actor) => {
      initializeActorBloodChargeFlags(actor).catch(() => {});
    });
  } catch (error) {
    handleError(error, {
      context: 'Blood Charge ready',
      severity: ErrorSeverity.CRITICAL
    });
  }
});

if (globalThis?.game) {
  try  {
    if (game.ready && !bloodChargeService._ready) {
      bloodChargeService.onReady().catch((error) => handleError(error,  {
        context: 'Blood Charge inline ready',
        severity: ErrorSeverity.WARNING
      }));
    }
  } catch (error) {
    handleError(error,  {
      context: 'Blood Charge inline bootstrap',
      severity: ErrorSeverity.WARNING,
      notify: false
    });
  }
}

export async function initBloodCharge() {
  return bloodChargeService.onInit();
}

export async function readyBloodCharge() {
  return bloodChargeService.onReady();
}

export { MODULE_ID, BloodChargeGMHub, BloodChargeService, bloodChargeService };
