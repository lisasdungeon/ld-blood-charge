/**
 * blood-charge-pc-widget.js
 * Minimal PC Blood Charge Widget for players to view and request Blood Charge changes
 */

import { MODULE_ID } from "../bc-constants.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

function localize(key) {
    return game?.i18n?.localize?.(key) ?? key;
}

function format(key, data = {}) {
    return game?.i18n?.format?.(key, data) ?? localize(key);
}

/**
 * Blood Charge PC Widget
 * A minimal player-facing hub for Blood Charge management
 */
export class BloodChargePCWidget extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(actor, options = {}) {
        super(options);
        this.actor = actor;
        // Named bound handlers per bible 12 - removable in close()
        this._onActorUpdate = this._onActorUpdate.bind(this);
        this._onSocketMessage = this._onSocketMessage.bind(this);
        this.hookRegistered = false;
        this.socketRegistered = false;
    }

    static DEFAULT_OPTIONS = {
        id: "blood-charge-pc-widget",
        tag: 'div',
        window: {
            icon: 'icons/svg/blood.svg',
            title: "Blood Charge",
            resizable: false,
            minimizable: true
        },
        position: {
            width: 320,
            height: 'auto'
        },
        classes: ['blood-charge-pc-widget']
    };

    static PARTS = {
        content: { template: `modules/${MODULE_ID}/blood-charge-templates/blood-charge-pc-widget.html` }
    };

    get title() {
        return `${localize('LD.BloodCharge.PlayerWidget.Title')} - ${this.actor?.name ?? 'Unknown'}`;
    }

    async _prepareContext(options) {
        const actor = this.actor;
        if (!actor) return { error: true, message: localize('LD.BloodCharge.Notifications.NoCharacter') };

        const currentCharge = actor.getFlag(MODULE_ID, 'bloodCharge') ?? 0;
        const maxCharge = actor.getFlag(MODULE_ID, 'bloodChargeMax') ?? 5;
        const chargePercentage = maxCharge > 0 ? Math.round((currentCharge / maxCharge) * 100) : 0;

        const chargePips = [];
        for (let i = 1; i <= maxCharge; i++) {
            chargePips.push({
                index: i,
                filled: i <= currentCharge
            });
        }

        return {
            actor: actor,
            actorId: actor.id,
            actorName: actor.name,
            actorImg: actor.img,
            currentCharge,
            maxCharge,
            chargePercentage,
            chargePips,
            isOwner: actor.isOwner,
            canRequest: !game.user.isGM && actor.isOwner
        };
    }

    async _onRender(context, options) {
        await super._onRender(context, options);
        const html = this.element;

        // Register hooks once per bible 12 - hookRegistered flag prevents dupes
        if (!this.hookRegistered) {
            Hooks.on('updateActor', this._onActorUpdate);
            this.hookRegistered = true;
        }

        // Register socket listener once
        if (!this.socketRegistered) {
            game.socket.on(`module.${MODULE_ID}`, this._onSocketMessage);
            this.socketRegistered = true;
        }

        this._domAbort?.abort();
        this._domAbort = new AbortController();
        const { signal } = this._domAbort;

        html.querySelector('.bc-bargain-btn')?.addEventListener('click', async (ev) => {
            ev.preventDefault();
            if (game.user.isGM) {
                const current = this.actor.getFlag(MODULE_ID, 'bloodCharge') ?? 0;
                const max = this.actor.getFlag(MODULE_ID, 'bloodChargeMax') ?? 5;
                if (current < max) {
                    await this.actor.setFlag(MODULE_ID, 'bloodCharge', current + 1);
                    ui.notifications.info(format('LD.BloodCharge.Notifications.ChargeAdded', { actorName: this.actor.name }));
                    this.render({ force: true });
                } else {
                    ui.notifications.warn(format('LD.BloodCharge.Notifications.MaxReached', { actorName: this.actor.name }));
                }
            } else {
                game.socket.emit(`module.${MODULE_ID}`, {
                    type: 'REQUEST_BLOOD_CHARGE_CHANGE',
                    payload: { actorId: this.actor.id, action: 'bargain', requesterId: game.user.id }
                });
                ui.notifications.info(localize('LD.BloodCharge.Notifications.BargainSent'));
            }
        }, { signal });

        html.querySelector('.bc-surge-btn')?.addEventListener('click', async (ev) => {
            ev.preventDefault();
            const current = this.actor.getFlag(MODULE_ID, 'bloodCharge') ?? 0;
            if (current > 0) {
                if (game.user.isGM || this.actor.isOwner) {
                    await this.actor.setFlag(MODULE_ID, 'bloodCharge', current - 1);
                    ui.notifications.info(format('LD.BloodCharge.Notifications.ChargeUsed', { actorName: this.actor.name }));
                    // Notify peers
                    game.socket?.emit(`module.${MODULE_ID}`, {
                        type: 'BLOOD_CHARGE_UPDATED',
                        payload: { actorId: this.actor.id, newValue: current - 1, delta: -1 }
                    });
                    this.render({ force: true });
                }
            } else {
                ui.notifications.warn(localize('LD.BloodCharge.Notifications.NoChargeAvailable'));
            }
        }, { signal });

        html.querySelector('.bc-close-btn')?.addEventListener('click', () => this.close(), { signal });
    }

    // Named handler - updateActor hook
    _onActorUpdate(updatedActor, updateData) {
        if (!updatedActor || updatedActor.id !== this.actor?.id) return;
        const hasChargeUpdate = foundry.utils?.hasProperty(updateData, `flags.${MODULE_ID}.bloodCharge`)
            || foundry.utils?.hasProperty(updateData, `flags.${MODULE_ID}`)
            || updateData?.flags?.[MODULE_ID];
        if (hasChargeUpdate) {
            this.render({ force: true });
        }
    }

    // Named handler - socket messages
    _onSocketMessage(data) {
        const action = data?.action ?? data?.type;
        const actorId = data?.payload?.actorId;
        if (action === 'BLOOD_CHARGE_UPDATED' && actorId === this.actor?.id) {
            this.render({ force: true });
        }
    }

    // Cleanup per bible 12 - unregister before super.close()
    async close(options = {}) {
        this._domAbort?.abort();
        this._domAbort = null;
        if (this.hookRegistered) {
            Hooks.off('updateActor', this._onActorUpdate);
            this.hookRegistered = false;
        }
        if (this.socketRegistered) {
            game.socket.off(`module.${MODULE_ID}`, this._onSocketMessage);
            this.socketRegistered = false;
        }
        return super.close(options);
    }
}

/**
 * Open the Blood Charge PC Widget for the current user's character
 */
export function openBloodChargePCWidget() {
    const actor = canvas.tokens.controlled[0]?.actor || game.user.character;
    if (!actor) {
        return ui.notifications.warn(localize('LD.BloodCharge.Notifications.TokenRequired'));
    }
    if (!actor.isOwner) {
        return ui.notifications.warn(localize('LD.BloodCharge.Notifications.OwnershipRequired'));
    }

    let existingApp = null;
    const instances = foundry.applications?.instances;
    if (instances?.forEach) {
        instances.forEach((app) => {
            if (!existingApp && app instanceof BloodChargePCWidget && app.actor?.id === actor.id) {
                existingApp = app;
            }
        });
    }
    if (!existingApp) {
        existingApp = Object.values(ui.windows || {}).find(
            (app) => app instanceof BloodChargePCWidget && app.actor?.id === actor.id
        );
    }

    if (existingApp) {
        try {
            if (existingApp.element) existingApp.bringToFront?.();
        } catch (_) { /* ignore */ }
        existingApp.render({ force: true });
    } else {
        new BloodChargePCWidget(actor).render({ force: true });
    }
}
