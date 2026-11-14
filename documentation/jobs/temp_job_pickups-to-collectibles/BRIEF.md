# Brief — Move launcher pickups into features/collectibles

Task: Move launcher pickups into features/collectibles · Lap: temp_job_pickups-to-collectibles

## Problem
Sky drops live in two features: point orbs in `collectibles`, the rocket-launcher crate (drop schedule, fall/land, touch pickup, crate drawing) in `combat` — against combat D2 and match-rules D2 ("one home for everything that drops from the sky").

## Success check
All existing tests pass (combat's three pickup tests moved to `collectibles/services/weaponCrates.test.ts` with unchanged assertions) and a deterministic headless start-arena run through the real `stepGame` + `renderGame` + sound-cue mapping produces byte-identical screenshots, event log and cue log before and after.

## In scope
- Crate state, schedule, fall/land, out-of-bounds and touch → `collectibles` (`weaponCrates.ts`); drop timer, fall speed and touch test shared with orbs (`skyDrops.ts`).
- Combat keeps weapons, ammo, firing; `takeWeaponPickups` arms the collector and emits `pickupSpawned` / `pickupCollected`.
- Crate layer + crate contact shadow → `collectibles`; the contact-shadow layer becomes a shared util (`contactShadowLayer.ts`) used by combat (rockets) and collectibles (crates).

## Out of scope
- Will NOT touch: tunables paths (`combat.drops` stays), event names, sound mapping, visuals, sim order.

## Edges
| Feature area | Hook point | Ride / new |
|---|---|---|
| combat | `stepCombat` loses crates; `takeWeaponPickups` | ride |
| collectibles | `stepWeaponCrates`, view layers `shadows` / `crates` / `orbs` | new files in feature |
| match | step 3a in `gameSim`, layer order in `gameRenderer` | ride |
| shared/utils | `contactShadowLayer.ts` (extracted from combat renderer) | new |
| dive (test only) | `stepCombat` args | ride |

## Size
S — pure refactor of one concept across combat / collectibles / match.

## Decisions
- D1 Crates live in `collectibles`; no `collectibles → combat` dependency: match passes the step result to combat's api.
- D2 Crates step at 3a (right after combat), not with the orbs at 4: keeps exactly who can collect (dive eliminations at 3b happened after collection before) and the event `seq` order.
- D3 Crate tunables stay at `combat.drops` (tests and lobby untouched); moving them is a follow-up.
- D4 `createCombatState()` lost its now-unused `tunables` parameter (lint), four call sites updated.
- D5 Pickup entity ids no longer share combat's `nextEntityId` with rockets; ids are render keys only (identical frames verified).
