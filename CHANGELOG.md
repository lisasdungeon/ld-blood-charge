# Changelog

## [Unreleased]

- Rebrand to Lisa's Dungeon (`ld-*` module ids).
- Copy actor flags from the retired `rnk-*` id on first ready.
- Add LICENSE, package.json, syntax and validate checks.
- Keep existing worlds working via `ld-legacy-migrate.js`.


## [1.0.2] - 2026-07-20

### Fixed
- Scene control injects into **token** tools (v13/v14); removed fragile MutationObserver inject.
- ApplicationV2 `render({ force: true })` for hub/widget opens.
- GM Hub DOM listeners use **AbortController** (no stacked +/- buttons on re-render).
- Socket `REQUEST_BLOOD_CHARGE_CHANGE` no longer shadows `action`; opens hub + approval dialog correctly.
- Socket `BLOOD_CHARGE_UPDATED` refreshes V2 app instances (not only legacy `ui.windows`).
- Damage → blood charge automation via `dnd5e.damageActor` and `midi-qol.DamageApplied`.
- Sync `getFlag` usage (removed incorrect awaits).
- Removed release zips from package tree.

## [1.0.1] - 2026-04-16
- Verified Foundry VTT 14.
