# Brief — Apply the design language in game

Task: Apply the design language in game · Lap: temp_job_visual-pass · Harness: v0.44.0

## Problem
The live game still draws placeholder shapes; the owner picked Gumdrop Pop with line style E (DESIGN_LANGUAGE.md, mockup variant E) and the canvas doesn't look like it yet.

## Success check
At normal and 40 % zoom, a screenshot of the running game shows the variant E look (sky gradient + parallax, plum slab with lip and one ink edge, honey cells with grid/pips/cracks and no ink, mockup-shaped rockets, crate, explosion, Fredoka HUD cards), outlines stay within the screen clamps at every camera zoom, and a 4-player + explosions scene renders under 16.7 ms per frame in headless Chromium.

## In scope
Phase A (PR 1): sky + sun/clouds/hills parallax; solid slabs drawn from the level's platform shapes with lip and silhouette ink; destructible tiles (grid, pips, alt tone, cracks next to craters, no ink); rockets with smoke trail; launcher crate; helmet tube; point orbs; explosion starburst; impact pops (playerHit); cell debris (terrainDestroyed); contact-shadow layer for airborne pickups / rockets; HUD cards per § 7 incl. chunk pop-out; Fredoka loaded before any Pixi Text (timeout → fallback face); zoom-clamped outline widths (§ 3 table).
Phase B (PR 2, after #12 merges): blob redraw in style E inside `playerRenderer.ts` (egg body, tucked feet, silhouette ink pass, gradient + gloss, helmet gradient + emblem without outline, eyes, spawn blink), the Graphics-addChild deprecation (it lives in `drawHelmet`), tube folded into the player silhouette, player shadows onto the shared shadow layer.

## Out of scope
- Will NOT do: hit flash, screen shake, elimination droplets, helmet spring, reduced-motion handling — motion polish; follow-up task.
- Will NOT do: sound, menus/app chrome theme.
- Will NOT touch: sim behaviour, collision, tunables; `src/config/app-tasks.json`; `playerRenderer.ts` in phase A.

## Edges
| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| arena | flat-fill chunks | `terrainRenderer.ts`, new `backdropRenderer.ts` | ride |
| combat | placeholder pickups/rockets/blasts | `combatRenderer.ts` | ride |
| collectibles | orb star, fixed stroke | `collectiblesRenderer.ts` | ride |
| match | layer composition, HUD | `gameRenderer.ts`, `hudRenderer.ts`, `useGameSession.ts` | ride |
| shared | palette | `gamePalette.ts`, new `outlineWidth.ts`, `contactShadow.ts`, `gameFont.ts` | ride / new — 3+ consumers |
| player (phase B) | round blob | `playerRenderer.ts` | ride |

## Size
M — five render layers restyled plus three shared helpers; no sim change.
Cut into laps: none (two PRs on one lap, per orchestrator).

## Decisions
DECISIONS.md D1–D6.
