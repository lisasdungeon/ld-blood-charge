/**
 * Defines the main application class for the Blood Charge GM Hub.
 * ApplicationV2 version - manages GM interface for blood charge system.
 */
import { MODULE_ID } from '../bc-constants.js';

export class BloodChargeGMHub extends foundry.applications.api.ApplicationV2  {
  constructor(options = {}) {
    super(options);
  }

  static DEFAULT_OPTIONS =  {
    id: 'blood-charge-gm-hub',
    tag: 'form',
    window:  {
      icon: 'icons/svg/blood.svg',
      title: 'CRIMSON_BLOOD.HubTitle',
      resizable: false,
      minimizable: true
    },
    position:  {
      width: 550,
      height: 700
    },
    classes: ['blood-charge-hub']
  };

  static PARTS =  {
    form: { template: `modules/${MODULE_ID}/blood-charge-templates/blood-charge-gm-hub.html` }
  };

  async _prepareContext(options) {
    const players = game.users.filter(u => !u.isGM);
    const half = Math.ceil(players.length / 2);

    return  {
      playersLeft: players.slice(0, half),
      playersRight: players.slice(half),
      isGM: game.user.isGM
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const html = this.element;

    // Close button handling
    html.querySelector('.bc-close-btn')?.addEventListener('click', () => this.close());

    // Player card click handling (optional, maybe for opening sheet?)
    html.querySelectorAll('.bc-player-card').forEach(card => {
      card.addEventListener('click', (event) => {
        // Only if not clicking a control button
        if (!event.target.closest('button') && !event.target.closest('input')) {
          const playerId = event.currentTarget.dataset.playerId;
          console.log(`Curator clicked on player: ${playerId}`);
          // Maybe open sheet?
          // const actor = game.actors.get(playerId); // playerId might be userId or actorId depending on context
        }
      });
    });

    // Bring window to front
    if (typeof this.bringToFront === 'function') {
        this.bringToFront();
    }
  }

  toJSON() {
    return  {
      ...super.toJSON()
    };
  }
}


