# collectibles

## Purpose

Everything that drops from the sky (combat D2, match-rules D2). **Point orbs** (GDD § 5: "points that fall from the roof"): they appear above the level's `point-orb` collectible points on a fixed schedule, fall onto the authored point and hover there; the first player touching one takes it; match turns what was collected into score. **Weapon crates** (GDD § 3, § 4): the rocket launcher and the homing launcher drop from the level's drop points (a drop point's weapon items in turn, by one counter over all released crates, homing-missiles D4), falls and lands on terrain (falls again when the ground is blasted away), vanishes out of bounds (match passes its kill zone); the first player touching one takes it and match hands that to combat, which arms them.

## Structure

| Layer    | Path                               | Purpose                                                                                                                                                                            |
| -------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types    | `types/collectibles.types.ts`      | `PointOrb`, `WeaponCrate`, `WeaponCratesState`, `CollectiblesState` (orbs, spawn timer, round-robin index, `crates`), `OrbCollected`, `CrateStepResult`                            |
| Services | `services/skyDrops.ts`             | Shared drop mechanics: `tickDropTimer` (deterministic schedule), `fallSpeed` (match gravity), `firstToucher` (touch pickup)                                                       |
| Services | `services/weaponCrates.ts`         | `createWeaponCratesState`, `stepWeaponCrates({ crates, drops, players, terrain, bounds, tunables, dt })` → `{ spawned, collected }`; round-robin drop points, half-cell fall sub-steps, landing |
| Services | `services/weaponCrateRenderer.ts`  | Style-E crate whose face shows its weapon: `drawCrate({ itemId })` draws the weapon's tube silhouette (`shared/utils/weaponTube`; capped tube for the rocket launcher, twin pod for the homing launcher) in ink inside a ring in the weapon accent (`gamePalette.weaponLook`); keyed by id, item and outline step; contact shadow of a falling crate (shared `contactShadowLayer`) |
| Services | `services/collectiblesSim.ts`      | `createCollectiblesState(tunables)` (orbs + crates), `stepCollectibles({ collectibles, points, players, tunables, dt })` → orbs collected this step. Pure TS, no randomness or clock               |
| Services | `services/collectiblesRenderer.ts` | View layers `shadows`, `crates`, `orbs`; bubblegum star (DESIGN_LANGUAGE § 1 Effects) with the zoom-clamped prop outline (rebuilt when its step changes), hover bob; `createCollectiblesView`, `syncCollectiblesView` |
| API      | `api/collectiblesApi.ts`           | The seam `match` uses                                                                                                                                                              |

## Dependencies

- `level` (collectible and drop points), `player` (`playerBody` for touch), `arena` (`rectHitsSolid`, `surfaceBelow` for crates) through their `api/` files.
- Shared: `gameTunables` (`collectibles` section, `combat.drops` for crates, world gravity), `gamePalette` (`pointOrb`, `pickupCrate`, `weaponLook`), `weaponTube` + `weaponTubeRenderer` (crate mark), `weaponItems` (`isWeaponItemId`), `weaponItems.types` (`WeaponItemId`), `contactShadowLayer`.
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
- A crate shows what it holds: its face is the weapon's tube silhouette in a ring of the weapon accent, from the shared look table, so every new weapon gets its own crate from one `weaponLooks` entry (weapon-visuals D1).
