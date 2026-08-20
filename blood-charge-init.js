/**
 * blood-charge-init.js
 * --- MODIFIED: Defines BloodChargeGMHub class and exports init/ready functions ---
 */

import { MODULE_ID } from "./bc-constants.js";
import { logger } from "./common/crimson-logger.js";

/**
 * Blood Charge GM Hub
 * Uses Foundry VTT ApplicationV2 framework
 */
export class BloodChargeGMHub extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
    // --- Store player data internally ---
    constructor(options = {}) {
        super(options);
        this.players = []; // Will be populated in _prepareContext
    }

    static DEFAULT_OPTIONS =  {
        id: "blood-charge-gm-hub",
        tag: 'form',
        window:  {
            icon: 'icons/svg/blood.svg',
            title: "Crimson Blood",
            resizable: true,
            minimizable: true
        },
        position:  {
            width: 750,
            height: 'auto'
        }
    };

    static PARTS =  {
        form: { template: `modules/${MODULE_ID}/blood-charge-templates/blood-charge-gm-hub.html` }
    };

    async _prepareContext(options) {
        // Fetch player actors with owner
        const allPlayers = game.actors.filter(a => a.type === 'character' && a.hasPlayerOwner);
        const playerDataPromises = allPlayers.map(async actor =>  {
             // --- FIX: Use correct flag scope ---
            const currentCharge = await actor.getFlag(MODULE_ID, 'bloodCharge') ?? 0;
            const maxCharge = await actor.getFlag(MODULE_ID, 'bloodChargeMax') ?? 5; // Default max to 5 if not set
            return  {
                id: actor.id,
                name: actor.name,
                img: actor.img,
                currentCharge: currentCharge,
                maxCharge: maxCharge
            };
        });

        this.players = await Promise.all(playerDataPromises);

        // Simple split for layout (adjust if needed)
        const midPoint = Math.ceil(this.players.length / 2);
        const playersLeft = this.players.slice(0, midPoint);
        const playersRight = this.players.slice(midPoint);

        return  {
            playersLeft: playersLeft,
            playersRight: playersRight
        };
    }

    async _onRender(context, options) {
        await super._onRender(context, options);

        logger.debug('Blood Charge', 'GM Hub activating listeners');
        const html = this.element;

        // Close button
        html.querySelector('.close-btn')?.addEventListener('click', () => this.close());

        // Player Tab Controls
        html.querySelectorAll('.player-tab[data-player-id]').forEach((el) =>  {
            const playerId = el.dataset.playerId;
            const actor = game.actors.get(playerId);
            if (!actor) return;

            // Subtract Charge Button
            el.querySelector('button[data-action="subtract-charge"]')?.addEventListener('click', async (ev) =>  {
                ev.stopPropagation();
                await this._adjustCharge(actor, -1);
            });

            // Add Charge Button
            el.querySelector('button[data-action="add-charge"]')?.addEventListener('click', async (ev) =>  {
                ev.stopPropagation();
                await this._adjustCharge(actor, 1);
            });

            // Direct Set Input
            el.querySelector('input.player-charge-set-value')?.addEventListener('change', async (ev) =>  {
                 ev.stopPropagation();
                 const newValue = parseInt(ev.currentTarget.value);
                 if (!isNaN(newValue)) {
                     await this._setCharge(actor, newValue);
                 }
            });
        });

        // Global Controls
        const globalValueInput = html.querySelector('input.global-charge-set-value');

        // Add All Button
        html.querySelector('button[data-action="add-all"]')?.addEventListener('click', async () =>  {
            await this._adjustAllCharges(1);
        });

        // Subtract All Button
        html.querySelector('button[data-action="subtract-all"]')?.addEventListener('click', async () =>  {
            await this._adjustAllCharges(-1);
        });

        // Set All Button
        html.querySelector('button[data-action="set-all"]')?.addEventListener('click', async () =>  {
            const newValue = parseInt(globalValueInput?.value);
            if (!isNaN(newValue)) {
                await this._setAllCharges(newValue);
            }
        });

         // --- Hook to re-render if actor flags change ---
         // Store hook ID to remove later
         this._updateHookId = Hooks.on("updateActor", (updatedActor, updateData) =>  {
            // Check if the update is for a player in our list and involves the relevant flags
             if (this.players.some(p => p.id === updatedActor.id) && hasProperty(updateData, `flags.${MODULE_ID}`)) {
                 logger.debug('Blood Charge', `Actor ${updatedActor.name} updated. Re-rendering.`);
                 this.render(false); // Re-render the hub without forcing position change
             }
         });

        // Bring window to front
        if (typeof this.bringToFront === 'function') {
            this.bringToFront();
        }
    }

    // --- Helper to adjust charge for a single actor ---
    async _adjustCharge(actor, delta) {
        if (!actor) return;
         // --- FIX: Use correct flag scope ---
        const currentCharge = await actor.getFlag(MODULE_ID, 'bloodCharge') ?? 0;
        const maxCharge = await actor.getFlag(MODULE_ID, 'bloodChargeMax') ?? 5;
        const newValue = Math.clamp(currentCharge + delta, 0, maxCharge);

        if (newValue !== currentCharge) {
            logger.debug('Blood Charge', `Adjusting charge for ${actor.name} to ${newValue}`);
            // --- FIX: Use correct flag scope ---
            await actor.setFlag(MODULE_ID, 'bloodCharge', newValue);
            this._playChargeSound(delta); // Play sound effect
            // No need to call render here, the updateActor hook will handle it
        }
    }

    // --- Helper to set charge for a single actor ---
    async _setCharge(actor, value) {
        if (!actor) return;
         // --- FIX: Use correct flag scope ---
        const currentCharge = await actor.getFlag(MODULE_ID, 'bloodCharge') ?? 0;
        const maxCharge = await actor.getFlag(MODULE_ID, 'bloodChargeMax') ?? 5;
        const newValue = Math.clamp(value, 0, maxCharge);

        if (newValue !== currentCharge) {
            logger.debug('Blood Charge', `Setting charge for ${actor.name} to ${newValue}`);
            const delta = newValue - currentCharge; // Calculate delta for sound
            // --- FIX: Use correct flag scope ---
            await actor.setFlag(MODULE_ID, 'bloodCharge', newValue);
            this._playChargeSound(delta); // Play sound effect
            // No need to call render here, the updateActor hook will handle it
        }
    }


    // --- Helper to adjust charge for ALL players ---
    async _adjustAllCharges(delta) {
        logger.debug('Blood Charge', `Adjusting all charges by ${delta}`);
        for (const player of this.players) {
            const actor = game.actors.get(player.id);
            await this._adjustCharge(actor, delta); // Re-use single actor logic
        }
        this._playGlobalEffect(delta); // Play global visual effect
    }

    // --- Helper to set charge for ALL players ---
    async _setAllCharges(value) {
        logger.debug('Blood Charge', `Setting all charges to ${value}`);
        let anyChange = false; // Track if any actor actually changed
        let avgDelta = 0; // Calculate average change for sound/effect
        let changeCount = 0;

        for (const player of this.players) {
            const actor = game.actors.get(player.id);
            if (!actor) continue;
            // --- FIX: Use correct flag scope ---
            const currentCharge = await actor.getFlag(MODULE_ID, 'bloodCharge') ?? 0;
            const maxCharge = await actor.getFlag(MODULE_ID, 'bloodChargeMax') ?? 5;
            const newValue = Math.clamp(value, 0, maxCharge);

            if (newValue !== currentCharge) {
                // --- FIX: Use correct flag scope ---
                await actor.setFlag(MODULE_ID, 'bloodCharge', newValue);
                anyChange = true;
                avgDelta += (newValue - currentCharge);
                changeCount++;
            }
        }
        if (anyChange) {
            avgDelta = changeCount > 0 ? Math.round(avgDelta / changeCount) : 0;
            this._playChargeSound(avgDelta); // Play sound based on average change
            this._playGlobalEffect(avgDelta); // Play global visual effect
            // No need to call render here, the updateActor hook will trigger renders
        }
    }

    // --- Helper to play sound effect based on charge change ---
    _playChargeSound(delta) {
        if (delta === 0) return;
        const soundDir = `modules/${MODULE_ID}/blood-charge/blood-charge-assets/blood-charge-assets-sounds/`;
        const soundPrefix = delta > 0 ? "BC_Gain_" : "BC_Loss_"; // Assuming Loss sounds exist
        const chargeLevel = Math.abs(delta); // Or use target level? Decide convention
        const soundIndex = Math.floor(Math.random() * 5) + 1; // Random sound from 1-5
        const soundFile = `${soundDir}${soundPrefix}${chargeLevel}_${soundIndex}.mp3`;

        logger.debug('Blood Charge', `Playing sound: ${soundFile}`);
        AudioHelper.play({ src: soundFile, volume: 0.7, autoplay: true, loop: false }, true)
            .catch(err => logger.warn('Blood Charge', `Could not play sound ${soundFile}:`, err));
    }

    // --- Helper to trigger global visual effect ---
    _playGlobalEffect(delta) {
        if (delta === 0) return;
        const imageIndex = Math.floor(Math.random() * 30) + 1; // Random image from 1-30
        const imagePath = `modules/${MODULE_ID}/blood-charge/blood-charge-assets/blood-charge-assets-pics/${String(imageIndex).padStart(2, '0')}.png`;

        logger.debug('Blood Charge', `Emitting global image effect: ${imagePath} with delta ${delta}`);
        // Emit socket event for all clients to show the image
        game.socket.emit(`module.${MODULE_ID}`,  {
            action: 'showImageEffect',
            imagePath: imagePath,
            chargeDelta: delta
        });
    }

     // --- Clean up hook on close ---
     async close(options = {}) {
        if (this._updateHookId) {
            Hooks.off("updateActor", this._updateHookId);
            this._updateHookId = null;
             logger.debug('Blood Charge', 'Unregistered updateActor hook');
        }
        return super.close(options);
     }

    /**
     * Convert the Application state to a JSON object for persistence.
     */
    toJSON() {
        return  {
            ...super.toJSON(),
            players: this.players
        };
    }
} // End BloodChargeGMHub Class

// --- Global effect display function ---
function BloodCharge_ShowGlobalImage(imagePath, chargeDelta) {
    $('#blood-charge-global-effect').remove();
    let deltaText = '';
    let deltaColor = '#cc0000'; // Default red for negative/zero
    if (chargeDelta > 0) {
        deltaText = `+${chargeDelta}`;
        deltaColor = '#00ff00'; // Green for positive
    } else if (chargeDelta < 0) {
        deltaText = `${chargeDelta}`;
        // deltaColor remains red
    }
    const html = `
      <div id="blood-charge-global-effect" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index: 9999; justify-content:center; align-items:center; cursor: pointer;" title="Click to close">
        <div class="blood-charge-image-wrapper" style="position: relative; max-width: 80%; max-height: 80%;">
            <img src="${imagePath}" style="display: block; max-width: 100%; max-height: 100%; border: 5px solid #cc0000; box-shadow: 0 0 30px #cc0000;">
            ${deltaText ? `<div class="blood-charge-delta-text" style="position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); font-size: 72px; font-weight: bold; color: ${deltaColor}; text-shadow: 0 0 10px #000, 0 0 20px #000, 0 0 30px #000; -webkit-text-stroke: 2px #000;">
                ${deltaText}
            </div>` : ''}
        </div>
      </div>`;
    $('body').append(html);
    $('#blood-charge-global-effect').css('display', 'flex').hide().fadeIn(200);
    // Auto-close after a delay AND allow click-to-close
    const timeoutId = setTimeout(() =>  {
         $('#blood-charge-global-effect').fadeOut(500, () => $('#blood-charge-global-effect').remove());
    }, 5000); // Close after 5 seconds

    $('#blood-charge-global-effect').on('click', (event) =>  {
        clearTimeout(timeoutId); // Prevent auto-close if clicked
        $(event.currentTarget).fadeOut(500, () => $(event.currentTarget).remove());
    });
}

// --- Exported init function ---
export async function initBloodCharge() {
  logger.log('Blood Charge', 'Initializing templates and partials');
  try  {
    const templatePath = `modules/${MODULE_ID}/blood-charge-templates/`;
    const templatesToLoad = [
      `${templatePath}blood-charge-gm-hub.html`,
      `${templatePath}blood-charge-player-tab.html`,
      `${templatePath}blood-charge-pc-widget.html`
    ];
    await foundry.applications.handlebars.loadTemplates(templatesToLoad);

    // Register partials AFTER templates are loaded
    Handlebars.registerPartial('blood-charge-player-tab', await foundry.applications.handlebars.getTemplate(`${templatePath}blood-charge-player-tab.html`));
    Handlebars.registerPartial('blood-charge-charge-display', await foundry.applications.handlebars.getTemplate(`${templatePath}blood-charge-charge-display.html`));

    logger.log('Blood Charge', 'Templates and partials registered successfully');
  } catch (e) {
    logger.error('Blood Charge', 'FATAL ERROR loading templates:', e);
  }
}

// --- Exported ready function ---
export async function readyBloodCharge() {
  logger.log('Blood Charge', 'Module ready, initializing application');

  // Ensure game[MODULE_ID] exists
  if (!game[MODULE_ID]) game[MODULE_ID] = {};

  // Instantiate and expose the GM Hub ONLY if it hasn't been done already
  if (game.user?.isGM && !game[MODULE_ID].bloodChargeHub) {
      try  {
          game[MODULE_ID].bloodChargeHub = new BloodChargeGMHub();
          logger.debug('Blood Charge', 'GM Hub Instance created and exposed');
      } catch (e) {
          logger.error('Blood Charge', 'Failed to instantiate BloodChargeGMHub:', e);
          return;
      }
  } else if (game.user?.isGM) {
      logger.debug('Blood Charge', 'GM Hub Instance already exists');
  }


  // Socket listener setup
  game.socket.on(`module.${MODULE_ID}`, (data) =>  {
    if (data.action === 'showImageEffect' && data.imagePath) {
        BloodCharge_ShowGlobalImage(data.imagePath, data.chargeDelta);
    }
  });

  // Define global paths if not already defined (though ideally done elsewhere if needed sooner)
  if (typeof window.BLOOD_CHARGE_DATA_PATHS === 'undefined') {
       // --- FIX: Use correct flag scope ---
      window.BLOOD_CHARGE_DATA_PATHS =  {
          currentCharge: `flags.${MODULE_ID}.bloodCharge`,
          maxCharge: `flags.${MODULE_ID}.bloodChargeMax`
      };
      logger.debug('Blood Charge', 'window.BLOOD_CHARGE_DATA_PATHS defined');
  }
}
