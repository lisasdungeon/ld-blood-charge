/**
 * Copy actor flags from the retired RNK module id onto the LD id.
 * Runs once on ready so existing worlds keep their data.
 */
export async function migrateLegacyFlags(moduleId, legacyId) {
  const actors = globalThis.game?.actors;
  if (!actors || !moduleId || !legacyId || moduleId === legacyId) return 0;
  let moved = 0;
  for (const actor of actors) {
    const legacy = actor.flags?.[legacyId];
    if (legacy == null) continue;
    const current = actor.flags?.[moduleId];
    const empty = current == null || (typeof current === "object" && !Object.keys(current).length);
    if (!empty) continue;
    try {
      const clone = globalThis.foundry?.utils?.deepClone
        ? foundry.utils.deepClone(legacy)
        : JSON.parse(JSON.stringify(legacy));
      await actor.update({ [`flags.${moduleId}`]: clone });
      moved += 1;
    } catch (err) {
      console.warn(`${moduleId} | legacy flag migrate failed for ${actor.name}`, err);
    }
  }
  return moved;
}
