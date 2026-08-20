# LD Blood Charge

**Module ID:** `ld-blood-charge`  
**Version:** 1.0.2  
**System:** dnd5e (Foundry VTT v13+, verified v14)  
**Requires:** none

---

## Overview

Blood Charge is a standalone resource-tracking module for vampire and dark-fantasy play. Player characters accumulate Blood Charge through combat, damage taken, and ability use. A GM Hub lets the Curator manage all player charges in real time; a Player Widget gives each bloodbound character a view of their current reserves and the ability to bargain for more.

---

## Features

- **GM Hub** - Full charge management panel. Set, add, or drain Blood Charge for any player character. View analytics and charge history.
- **Player Widget** - Compact personal view of current and maximum Blood Charge. Players can send a bargain request to the GM directly from the widget.
- **Scene Control Button** - One-click access from the Foundry toolbar for both GMs and players.
- **Automatic tracking** - Hooks into DnD5e activity consumption so Blood Charge is spent automatically when triggered abilities are used.
- **Migration support** - Migrates item attribute paths from legacy module IDs automatically on load.

---

## Scene Control

A Blood Charge button appears in the Foundry scene controls toolbar:

| User Role | Button Action |
|-----------|--------------|
| GM (Curator) | Opens the Blood Charge GM Hub |
| Player | Opens the personal Blood Charge Widget |

---

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Blood Charge Maximum | `10` | Default maximum Blood Charge for all player characters |

---

## Flags

Blood Charge values are stored as actor flags under the `ld-blood-charge` namespace:

| Flag | Type | Description |
|------|------|-------------|
| `flags.ld-blood-charge.bloodCharge` | `number` | Current Blood Charge |
| `flags.ld-blood-charge.bloodChargeMax` | `number` | Maximum Blood Charge |

---

## Deployment

This module is deployed directly to the live Foundry server as a standalone module folder.

It does not depend on a parent module to run.

---

## Authors

- **LD** - [GitHub](https://github.com/ld-crimson-blood)  
- **Lisa's Dungeon**

---

## License

This module is part of the RNK proprietary codebase.
