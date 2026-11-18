# collectibles

## Purpose

Everything that drops from the sky (combat D2, match-rules D2). **Point orbs** (GDD § 5: "points that fall from the roof"): they appear above the level's `point-orb` collectible points on a fixed schedule, fall onto the authored point and hover there; the first player touching one takes it; match turns what was collected into score. **Weapon crates** (GDD § 3, § 4): weapon crates drop from the level's drop points, holding the match's weapons setting (`tunables.match.weaponIds`: every weapon by default, narrowed by the lobby or a level's `data-weapons`) in turn, by one counter over all released crates (homing-missiles D4, level-direction D6); an empty setting drops none. A crate falls and lands on terrain (falls again when the ground is blasted away), vanishes out of bounds (match passes its kill zone); the first player touching one takes it and match hands that to combat, which arms them.

## Structure

| Layer    | Path                               | Purpose                                                                                                                                                                            |
| -------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types    | `types/collectibles.types.ts`      | `PointOrb`, `WeaponCrate`, `WeaponCratesState`, `CollectiblesState` (orbs, spawn timer, round-robin index, `crates`), `OrbCollected`, `CrateStepResult`                            |
| Services | `services/skyDrops.ts`             | Shared drop mechanics: `tickDropTimer` (deterministic schedule), `fallSpeed` (match gravity), `firstToucher` (touch pickup)                                                       |
| Services | `services/weaponCrates.ts`         | `createWeaponCratesState`, `stepWeaponCrates({ crates, drops, players, terrain, bounds, tunables, dt })` → `{ spawned, collected }`; round-robin drop points, half-cell fall sub-steps, landing |
| Services | `services/weaponCrateRenderer.ts`  | Style-E crate that shows its weapon: `drawCrate({ itemId })` fills the crate with the weapon accent (`gamePalette.weaponLook`), adds one white gloss oval, and centres the weapon's mouth mark (`weaponTubeMark` from `shared/utils/weaponTube`) on it in ink inside a white outline; keyed by id, item and outline step; contact shadow of a falling crate (shared `contactShadowLayer`) |
| Services | `services/collectiblesSim.ts`      | `createCollectiblesState(tunables)` (orbs + crates), `stepCollectibles({ collectibles, points, players, tunables, dt })` → orbs collected this step. Pure TS, no randomness or clock               |
| Services | `services/diveRefills.ts`          | Headbutt resets (item `dive-reset`): `createDiveRefills(points)`, `stepDiveRefills({ refills, players, tunables, dt })` → taken this step; fixed pickups, respawn timer, one per player per step |
| Services | `services/diveRefillRenderer.ts`   | Aqua diamond crystal, bob, pop-in on return, ring burst on take, ghost outline while gone (all from sim state) |
| Services | `services/collectiblesRenderer.ts` | View layers `shadows`, `crates`, `orbs`; bubblegum star (DESIGN_LANGUAGE § 1 Effects) with the zoom-clamped prop outline (rebuilt when its step changes), hover bob; `createCollectiblesView`, `syncCollectiblesView` |
| API      | `api/collectiblesApi.ts`           | The seam `match` uses                                                                                                                                                              |

## Dependencies

- `level` (collectible and drop points), `player` (`playerBody` for touch), `arena` (`rectHitsSolid`, `surfaceBelow` for crates) through their `api/` files.
- Shared: `gameTunables` (`collectibles` section, `combat.drops` for crates, world gravity), `gamePalette` (`pointOrb`, `crateMarkOutline`, `gloss`, `weaponLook`), `weaponTube` + `weaponTubeRenderer` (crate mark), `weaponItems` (`isWeaponItemId`), `weaponItems.types` (`WeaponItemId`), `contactShadowLayer`.
- Used by `match` (sim step 3a crates → combat's `takeWeaponPickups`, step 4 orbs; render layers). No dependency on `combat`.

## Decisions

- Own feature, as combat D2 recorded for point collectibles; launcher crates moved here (pickups-to-collectibles D1): one home for sky drops, combat keeps weapons, ammo and firing.
- Crates step at 3a, right after combat, not at 4 with the orbs: a player eliminated by a dive (3b) could still take a crate in the same step before, and the event order (`pickupSpawned` / `pickupCollected` before dive hits) stays the same (pickups-to-collectibles D2).
- Crate tunables stay at `combat.drops` (no path change, so lobby overrides and tests keep working); moving them under `collectibles` is a follow-up (pickups-to-collectibles D3).
- Schedule mirrors combat D6: first after `firstDelaySeconds`, then every `intervalSeconds` while fewer than `maxActive` orbs exist, round-robin over the `point-orb` points, skipping a point that already holds an orb.
- An orb falls onto its authored point and hovers there, without terrain collision, so a blasted floor never strands one (match-rules D2).
- Players waiting to respawn are not passed in, so they cannot collect.
- Orbs and crates share one touch test (`skyDrops.firstToucher`); combat no longer has a `rectsOverlap`, so there is one copy.
- Test levels list terrain as `{ shape, materialId }` only: terrain has no role since level format 2 (material-system D5).
- **Headbutt resets** (FEEDBACK_ROUND_2 § 2.3) live here as a third pickup kind: placed on the existing `collectible` role with `data-item="dive-reset"`, so no format change (headbutt-reset D1). Fixed on the point from the match start, no falling. The match passes only players whose dive is spent, so a charged player flies through without taking it, and this feature never imports `dive` (D2). Gone `collectibles.diveRefill.respawnSeconds` (2.5 s, Celeste's refill crystal) after use (D3). Code names it a dive refill (`diveRefills`) so it is not confused with `resetDive` (the respawn wipe).
- A crate shows what it holds (owner, weapon-visuals-embellish D9, D10): the whole crate is the weapon accent, the weapon's mouth sits centred on it in ink inside a white outline (no cream face, ring or window), and it carries one white gloss oval like the blob's. Both come from the shared look table, so every new weapon gets its own crate from one `weaponLooks` entry.
