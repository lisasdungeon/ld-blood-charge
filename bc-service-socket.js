/**
 * Blood Charge socket listener
 */
import {
  MODULE_ID,
  BloodChargeGMHub,
  BloodCharge_ShowGlobalImage,
  BloodCharge_ShowChargeChangeEffect,
  grantBloodCharges
} from './blood-charge-core.js';

function localize(key) {
  return game?.i18n?.localize?.(key) ?? key;
}

function format(key, data = {}) {
  return game?.i18n?.format?.(key, data) ?? localize(key);
}

export function _registerSocketListener() {
  if (this._socketRegistered || !game?.socket) return;

  this._socketHandler = (data) =>  {
    console.debug('Blood Charge | socket message received:', data);
    const action = data?.action ?? data?.type;
    if (!action) return;

    if (action === 'showImageEffect' && data.imagePath) {
      BloodCharge_ShowGlobalImage(data.imagePath, data.chargeDelta);

    } else if (action === 'showChargeChangeEffect' && data.effectData) {
      BloodCharge_ShowChargeChangeEffect(data.effectData);

    } else if (action === 'BLOOD_CHARGE_UPDATED') {
      const { actorId } = data.payload || data || {};
      if (!actorId) return;
      const actor = game.actors.get(actorId);
      if (actor?.sheet?.rendered) actor.sheet.render(false);
      if (game.user.isGM && game[MODULE_ID]?.bloodChargeHub?.rendered) {
        game[MODULE_ID].bloodChargeHub.render({ force: true });
      }
      // Re-render open PC widgets for this actor
      const apps = foundry.applications?.instances;
      if (apps?.forEach) {
        apps.forEach((app) => {
          if (app?.actor?.id === actorId && typeof app.render === 'function') {
            app.render({ force: true });
          }
        });
      }
      Object.values(ui.windows || {}).forEach((w) => {
        if (w?.actor?.id === actorId && typeof w.render === 'function') {
          w.render({ force: true });
        }
      });

    } else if (action === 'REQUEST_BLOOD_CHARGE_CHANGE') {
      if (!game.user.isGM) return;
      const payload = data.payload || {};
      const actorId = payload.actorId;
      const requesterId = payload.requesterId;
      const actor = game.actors.get(actorId);
      const user = game.users.get(requesterId);
      const requesterName = user?.name || 'Unknown';
      const actorName = actor?.name || 'Unknown';

      // Open / focus GM hub
      if (!game[MODULE_ID]) game[MODULE_ID] = {};
      let hub = game[MODULE_ID].bloodChargeHub;
      if (!hub) {
        hub = new BloodChargeGMHub();
        game[MODULE_ID].bloodChargeHub = hub;
      }
      hub.render({ force: true });

      new Dialog({
        title: localize('LD.BloodCharge.GMHub.RequestTitle'),
        content: format('LD.BloodCharge.GMHub.RequestContent', { requesterName, actorName }),
        buttons: {
          grant: {
            icon: '<i class="fas fa-check"></i>',
            label: localize('LD.BloodCharge.GMHub.Grant'),
            callback: async () => {
              if (!actor) return;
              await grantBloodCharges(actor, 1, `Granted by GM (${requesterName})`, 'GM Approval');
              ui.notifications.info(format('LD.BloodCharge.Notifications.GrantApproved', { actorName }));
              game[MODULE_ID]?.bloodChargeHub?.render({ force: true });
            }
          },
          deny: {
            icon: '<i class="fas fa-times"></i>',
            label: localize('LD.BloodCharge.GMHub.Deny'),
            callback: () => {
              ui.notifications.info(format('LD.BloodCharge.Notifications.GrantDenied', { requesterName }));
            }
          }
        },
        default: 'grant'
      }).render(true);
    }
  };

  game.socket.on(`module.${MODULE_ID}`, this._socketHandler);
  this._socketRegistered = true;
  console.log('Blood Charge | Socket listener registered.');
}
