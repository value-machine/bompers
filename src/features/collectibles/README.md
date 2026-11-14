# collectibles

## Purpose

Point orbs (GDD § 5: "points that fall from the roof"): they appear above the level's `point-orb` collectible points on a fixed schedule, fall onto the authored point and hover there; the first player touching one takes it. The match feature turns what was collected into score. Weapon pickups (rocket launcher) still live in `combat` for now.

## Structure

| Layer    | Path                                | Purpose                                                                                                                                                               |
| -------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types    | `types/collectibles.types.ts`       | `PointOrb`, `CollectiblesState` (orbs, spawn timer, round-robin index), `OrbCollected`                                                                                 |
| Services | `services/collectiblesSim.ts`       | `createCollectiblesState(tunables)`, `stepCollectibles({ collectibles, points, players, tunables, dt })` → orbs collected this step. Pure TS, no randomness or clock |
| Services | `services/collectiblesRenderer.ts`  | Bubblegum star layer (DESIGN_LANGUAGE § 1 Effects), hover bob; `createCollectiblesView`, `syncCollectiblesView`                                                         |
| API      | `api/collectiblesApi.ts`            | The seam `match` uses                                                                                                                                                  |

## Dependencies

- `level` (collectible points), `player` (`playerBody` for touch) through their `api/` files.
- Shared: `gameTunables` (`collectibles` section, world gravity), `gamePalette` (`pointOrb`).
- Used by `match` (sim step 4, render layer next to the weapon pickups).

## Decisions

- Own feature, as combat D2 recorded for point collectibles; launcher pickups may move here later (match-rules D2).
- Schedule mirrors combat D6: first after `firstDelaySeconds`, then every `intervalSeconds` while fewer than `maxActive` orbs exist, round-robin over the `point-orb` points, skipping a point that already holds an orb.
- An orb falls onto its authored point and hovers there, without terrain collision, so a blasted floor never strands one (match-rules D2).
- Players waiting to respawn are not passed in, so they cannot collect.
