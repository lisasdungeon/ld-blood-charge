import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateLegacyFlags } from '../ld-legacy-migrate.js';

test('migrateLegacyFlags no-ops without game.actors', async () => {
  const moved = await migrateLegacyFlags('ld-test', 'rnk-test');
  assert.equal(moved, 0);
});

test('migrateLegacyFlags copies empty current flags from legacy', async () => {
  const updates = [];
  const actor = {
    name: 'Test',
    flags: { 'rnk-test': { n: 3 } },
    update: async (data) => { updates.push(data); }
  };
  globalThis.game = { actors: [actor] };
  globalThis.foundry = { utils: { deepClone: (v) => JSON.parse(JSON.stringify(v)) } };
  try {
    const moved = await migrateLegacyFlags('ld-test', 'rnk-test');
    assert.equal(moved, 1);
    assert.deepEqual(updates[0], { 'flags.ld-test': { n: 3 } });
  } finally {
    delete globalThis.game;
    delete globalThis.foundry;
  }
});
