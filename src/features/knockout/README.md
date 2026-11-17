# knockout

## Purpose

What an eliminated blob does on screen (the owner's goo pick, elimination-goo lap). A lethal hit first sends the blob flying with its knockback in the shared roll (a copy of the victim stepped by the player controller, so it tumbles, bounces and rolls downhill like any hit blob). At the first hard contact (or after `flungMaxSeconds`) it squashes and bursts into goo droplets. An **overkill** hit (one that would take health below 0) skips the flight: the blob squashes and bursts on the spot, and the droplets carry the knockback. Droplets keep the blob's momentum and become splats the instant they touch terrain. The helmet and the weapon tube fly off as solid pieces and blink out at the respawn. Render-only: it reads the combat event log and never changes game state. Falling off the arena makes no knockout.

## Structure

| Layer    | Path                            | Purpose                                                                                                                                                                                                                                           |
| -------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types    | `types/knockout.types.ts`       | `GooDroplet`, `GooSplat`, `KnockoutPiece`, `KnockoutTunables` (`Knockout`, `KnockoutWorld` and `KnockoutBody` live in the sim: they hold a `PlayerState`, which `types/` may not import)                                                                                                                                        |
| Services | `services/knockoutSim.ts`       | `noteKnockoutEvents` (new `playerEliminated` events by `seq`; the copy enters the roll through `reactToHit`), `stepKnockouts` (flight through the injected `roll` step → squash → burst; droplets → splats; pieces until the respawn), `knockoutBodies`, `pieceAlpha`, `splatAlpha`. Droplets and pieces: `src/shared/utils/fallingBody.ts` |
| Services | `services/knockoutRenderer.ts`  | `createKnockoutView`, `syncKnockoutView`: splats, droplets and loose pieces, one sprite per key; per frame only transforms and alpha change                                                                                                        |
| API      | `api/knockoutApi.ts`            | Public seam                                                                                                                                                                                                                                       |

The flying and squashing blob is drawn by the player layer: each `KnockoutBody` carries its rolling copy of the victim, drawn under the id `ko-<seq>` (its spin is the roll's `rollAngle`), with the squash as a pose overlay. Match passes `roll` = `stepPlayers` with no input.

## Dependencies

- `combat` (`CombatEvent`: `playerEliminated` carries `overkill` and the victim's position and velocity) through its `api/` file.
- `player` (`reactToHit`: the shared roll; `PlayerState`; `drawLooseHelmet`, `drawLooseTube`: the blob's own shapes) through its `api/` file.
- `src/shared/utils/fallingBody.ts` (circle vs terrain point test), `displaySync`, `outlineWidth`, `gamePalette`; tunables `feel.knockout`.
- Consumed by `match` (`gameRenderer.ts` steps it with the terrain's `isSolidAt` and places the layer above effects, under rockets and players).

## Decisions

- The fling runs in the shared roll (orchestrator, after the shared-roll lap): no separate flight physics, so a knocked-out blob rolls exactly like a hit one until it bursts.
- Owner picks (2026-11-16, demo rounds 1–4): goo, not a ragdoll that falls apart; the helmet stays a solid object; droplets splat on contact (no squish phase); the flight is the hit's own knockback (no separate ragdoll step); the droplets keep the blob's momentum; overkill bursts at once; the respawn delay went from 1.2 s to 2.0 s so the splat is visible.
- Splats and pieces outlive the juice `linger` window on purpose (owner): pieces until the respawn, splats fading out by `splatSeconds` (4 s).
- Goo is the victim's body colour: that player's own feedback (DESIGN_LANGUAGE § 1).
- Its own feature (not `effects`): one concept (what a knockout does) with its own physics and three layers; effects stays the one-shot event pops.
- Spreads are deterministic per event `seq` (no RNG in render), like the effects debris.
- Not built: the elimination sound still plays at the moment of elimination, not at the burst (sound cues come from sim events); splats sit on terrain and are not clipped to it.
