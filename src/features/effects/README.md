# effects

## Purpose

Visual feedback drawn from sim events (DESIGN_LANGUAGE § 5 step 6, § 6): explosion starbursts, impact pops where a rocket or blast hits a player (dive hits draw their own pop in `features/dive`), and debris in the destroyed cells' colour swatch where terrain is destroyed. Presentation only: it reads the combat event log and never changes game state. Drawn under rockets and players, so effects never cover a player outline.

## Structure

| Layer    | Path                          | Purpose                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Services | `services/effectsRenderer.ts` | `createEffectsView`, `syncEffectsView(view, { events, timeSeconds, zoom })`: one sprite per event `seq` while it is live (blast 250 ms, pop 220 ms, debris 500 ms); per frame only transforms and alpha change                                                                                                                                                                                                |
| Services | `services/feelCues.ts`        | Game-feel cues: `readFeelCues(state, { events, bodies, nowMs, feel, … })` reads new combat events (by `seq`) and tumble-bounce counters per rendered frame → camera-shake kicks (hits, back hits ×`hardHitScale`, explosions by radius, tumble bounces by speed), per-player hit flashes (`hitFlashAmount`: hold, then fade; back hits stronger; gentler under reduced motion) and a hit-stop after back hits |
| API      | `api/effectsApi.ts`           | Public seam                                                                                                                                                                                                                                                                                                                                                                                                   |

Seams for later work:

- **Motion polish:** elimination droplets and landing smoke go here, keyed by their events. Hit flash, screen shake and hit-stop are built (`feelCues.ts`); tunables `feel`.
- **Sound:** reads the same events in its own module; nothing here plays audio.

## Dependencies

- `camera` (shake kicks) through its `api/` file; players are read through a structural `FeelBody` slice, so no `player` import.
- `combat` (`CombatEvent` type; `terrainDestroyed.colorId` picks the debris swatch from `gamePalette.terrainSwatch`) through its `api/` file.
- `pixi.js`, `src/shared/config/gamePalette.ts`, `src/shared/utils/{outlineWidth,displaySync,shapeGeometry}.ts`.
- Consumed by `match` (`gameRenderer.ts` places the layer).

## Decisions

- Split from `combat` (visual-pass): effects are a separate reason to change (look and motion) from fighting rules, and kept combat's services within budget.
- Game-feel cues live here (game-feel D3): they are event-driven feedback like the other effects; the camera owns only the shake math, the player only how a flash and a wobble are drawn.
- Debris is deterministic per event `seq` (no RNG in render), so the same event always looks the same.
- Stroke widths are the zoom-clamped effect width at the moment the effect appears; effects live too briefly to rebuild on zoom.
