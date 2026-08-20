/**
 * bc-effects.js
 * LD Blood Charge - Visual Effects
 * 
 * Handles visual and audio effects for blood charge changes.
 */

import { MODULE_ID } from './bc-constants.js';

/**
 * Display a global image effect with charge delta text
 * @param {string} imagePath - Path to the image to display
 * @param {number} chargeDelta - The charge delta value to display
 */
export function BloodCharge_ShowGlobalImage(imagePath, chargeDelta) {
  jQuery('#blood-charge-global-effect').remove();
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
  jQuery('body').append(html);
  jQuery('#blood-charge-global-effect').css('display', 'flex').hide().fadeIn(200);
  
  // Auto-close after a delay AND allow click-to-close
  const timeoutId = setTimeout(() => {
    jQuery('#blood-charge-global-effect').fadeOut(500, () => jQuery('#blood-charge-global-effect').remove());
  }, 5000); // Close after 5 seconds

  jQuery('#blood-charge-global-effect').on('click', (event) => {
    clearTimeout(timeoutId); // Prevent auto-close if clicked
    jQuery(event.currentTarget).fadeOut(500, () => jQuery(event.currentTarget).remove());
  });
}

/**
 * Display charge change effect with floating text and chat message
 * @param {Object} effectData - Data object containing actorId, delta, reason
 */
export function BloodCharge_ShowChargeChangeEffect(effectData) {
  const { actorId, delta, reason } = effectData;
  const actor = game.actors.get(actorId);
  if (!actor) return;

  // Find the actor's token on the canvas
  const token = canvas.tokens.placeables.find(t => t.actor?.id === actorId);
  if (!token) return;

  // Create floating text
  const textColor = delta > 0 ? '#00ff00' : '#ff0000';
  const textContent = delta > 0 ? `+${delta}` : `${delta}`;

  // Create the floating text element
  const floatingText = document.createElement('div');
  floatingText.textContent = textContent;
  floatingText.style.cssText = `
    position: absolute;
    color: ${textColor};
    font-size: 24px;
    font-weight: bold;
    text-shadow: 0 0 4px #000, 0 0 8px #000;
    pointer-events: none;
    z-index: 1000;
    animation: floatUp 2s ease-out forwards;
  `;

  // Position it above the token
  const tokenCenter = token.center;
  floatingText.style.left = `${tokenCenter.x - 20}px`;
  floatingText.style.top = `${tokenCenter.y - 40}px`;

  // Add animation keyframes if not already present
  if (!document.getElementById('blood-charge-animations')) {
    const style = document.createElement('style');
    style.id = 'blood-charge-animations';
    style.textContent = `
      @keyframes floatUp {
        0% { opacity: 1; transform: translateY(0); }
        100% { opacity: 0; transform: translateY(-60px); }
      }
    `;
    document.head.appendChild(style);
  }

  // Add to canvas
  canvas.stage.addChild(floatingText);

  // Remove after animation
  setTimeout(() => {
    if (floatingText.parent) {
      canvas.stage.removeChild(floatingText);
    }
  }, 2000);

  // Show reason as a chat message if provided
  if (reason) {
    ChatMessage.create({
      content: `<div style="color: ${textColor}; font-weight: bold;">${actor.name}: ${textContent} Blood Charge${Math.abs(delta) !== 1 ? 's' : ''} (${reason})</div>`,
      speaker: { actor: actor },
      type: CONST.CHAT_MESSAGE_TYPES.OTHER
    });
  }
}
