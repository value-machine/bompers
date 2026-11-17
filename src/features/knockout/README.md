# knockout

## Purpose

What an eliminated blob does on screen (the owner's goo pick, elimination-goo lap). A lethal hit first sends the blob flying with its knockback. At the first hard contact (or after `flungMaxSeconds`) it squashes and bursts into goo droplets. An **overkill** hit (one that would take health below 0) skips the flight: the blob squashes and bursts on the spot, and the droplets carry the knockback. Droplets keep the blob's momentum and become splats the instant they touch terrain. The helmet and the weapon tube fly off as solid pieces and blink out at the respawn. Render-only: it reads the combat event log and never changes game state. Falling off the arena makes no knockout.

## Structure

| Layer    | Path                            | Purpose                                                                                                                                                                                                                                           |
| -------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types    | `types/knockout.types.ts`       | `KnockoutWorld` (knockouts, droplets, pieces, splats), `KnockoutBody` (a flying blob for the player layer)                                                                                                                                        |
| Services | `services/knockoutSim.ts`       | `noteKnockoutEvents` (new `playerEliminated` events by `seq`), `stepKnockouts` (flight → squash → burst; droplets → splats; pieces until the respawn), `knockoutBodies`, `pieceAlpha`, `splatAlpha`. Physics: `src/shared/utils/fallingBody.ts` |
| Services | `services/knockoutRenderer.ts`  | `createKnockoutView`, `syncKnockoutView`: splats, droplets and loose pieces, one sprite per key; per frame only transforms and alpha change                                                                                                        |
| API      | `api/knockoutApi.ts`            | Public seam                                                                                                                                                                                                                                       |

The flying and squashing blob is drawn by the player layer: match turns each `KnockoutBody` into a copy of the victim's `PlayerState` under the id `ko-<seq>`, tumbling so it rolls, with the squash as a pose overlay.

## Dependencies

- `combat` (`CombatEvent`: `playerEliminated` carries `overkill` and the victim's position and velocity) through its `api/` file.
- `player` (`drawLooseHelmet`, `drawLooseTube`: the blob's own shapes) through its `api/` file.
- `src/shared/utils/fallingBody.ts` (circle vs terrain point test), `displaySync`, `outlineWidth`, `gamePalette`; tunables `feel.knockout`.
- Consumed by `match` (`gameRenderer.ts` steps it with the terrain's `isSolidAt` and places the layer above effects, under rockets and players).

## Decisions

- Owner picks (2026-11-16, demo rounds 1–4): goo, not a ragdoll that falls apart; the helmet stays a solid object; droplets splat on contact (no squish phase); the flight is the hit's own knockback (no separate ragdoll step); the droplets keep the blob's momentum; overkill bursts at once; the respawn delay went from 1.2 s to 2.0 s so the splat is visible.
- Splats and pieces outlive the juice `linger` window on purpose (owner): pieces until the respawn, splats fading out by `splatSeconds` (4 s).
- Goo is the victim's body colour: that player's own feedback (DESIGN_LANGUAGE § 1).
- Its own feature (not `effects`): one concept (what a knockout does) with its own physics and three layers; effects stays the one-shot event pops.
- Spreads are deterministic per event `seq` (no RNG in render), like the effects debris.
- Not built: the elimination sound still plays at the moment of elimination, not at the burst (sound cues come from sim events); splats sit on terrain and are not clipped to it.
