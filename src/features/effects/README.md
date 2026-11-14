# effects

## Purpose

Visual feedback drawn from sim events (DESIGN_LANGUAGE § 5 step 6, § 6): explosion starbursts, impact pops where a player is hit, and cell-coloured debris where terrain is destroyed. Presentation only: it reads the combat event log and never changes game state. Drawn under rockets and players, so effects never cover a player outline.

## Structure

| Layer    | Path                          | Purpose                                                                                                                                                                                                        |
| -------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Services | `services/effectsRenderer.ts` | `createEffectsView`, `syncEffectsView(view, { events, timeSeconds, zoom })`: one sprite per event `seq` while it is live (blast 250 ms, pop 220 ms, debris 500 ms); per frame only transforms and alpha change |
| API      | `api/effectsApi.ts`           | Public seam                                                                                                                                                                                                    |

Seams for later work:

- **Motion polish:** hit flash, screen shake, elimination droplets, smoke puffs on landing go here, keyed by their events (`playerHit`, `explosion`, `playerEliminated`).
- **Sound:** reads the same events in its own module; nothing here plays audio.

## Dependencies

- `combat` (`CombatEvent` type) and `content-catalog` (material look token for debris colours) through their `api/` files.
- `pixi.js`, `src/shared/config/gamePalette.ts`, `src/shared/utils/{outlineWidth,displaySync,shapeGeometry}.ts`.
- Consumed by `match` (`gameRenderer.ts` places the layer).

## Decisions

- Split from `combat` (visual-pass): effects are a separate reason to change (look and motion) from fighting rules, and kept combat's services within budget.
- Debris is deterministic per event `seq` (no RNG in render), so the same event always looks the same.
- Stroke widths are the zoom-clamped effect width at the moment the effect appears; effects live too briefly to rebuild on zoom.
