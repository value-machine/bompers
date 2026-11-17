# Brief — Moving parts in levels

Task: Moving parts in levels (owner, 2026-11-17) · Lap: temp_job_moving-parts (lap A of 2)

## Problem
Level authors (mostly AI agents writing blind from the "Copy AI prompt") cannot make terrain that slides, loops, spins or swings, and the game has no format, validation or preview for it.

## Success check
An agent that has only `LEVEL_PROMPT.md` writes `<g data-motion="slide 0,-160">…</g>` (and `path` / `spin` / `swing`), the importer turns it into a typed `LevelDefinition.movers` entry whose pose at any sim time comes from one pure function, bad specs import with a named warning, and the kit preview animates the group with the same timing.

## In scope (lap A: format, importer, preview, prompt)
- `data-motion` on a `<g>` of terrain shapes; grammar and defaults in DECISIONS D1–D6.
- Importer: parse + validate (motion warnings D9), `LevelDefinition.movers` (pieces in rest pose + motion spec + pivot resolved from the group's bounding box).
- One pure pose function `motionPose(spec, timeS)` → `{ dx, dy, angle }` in `src/shared/` (sim and later renderer use it); deterministic from round time.
- Kit preview animates moving groups and draws their sweep ghost (end pose / arc); its pose maths is the second copy, marked (code-style F2).
- `LEVEL_PROMPT.md` + `AUTHORING.md` + `LEVEL_FORMAT.md` sections generated / written with a worked example; catalog defaults (period, limits) exported via `level-kit:sync`.
- Game runtime in lap A: moving groups' shapes stay static terrain at their rest pose (exactly what the importer does with a `<g>` today) and import shows one info warning "moving parts are static in this version".

## Out of scope
- Will NOT do (lap B, follow-up task "Moving parts move in the game"): kinematic bodies, collision, riding/carry, push/crush, rockets/crates vs movers, in-game rendering + outline, juice.
- Will NOT do (later): breakable / burning moving parts, spawns/drops/pickups riding a mover, nested motion, easing choices beyond the defaults.
- Will NOT touch: `arena` collision, `player` controller, `combat`, the terrain field (the terrain-chain thread owns them now).

## Edges
| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| `level-file` | `<g>` ignored, shapes inside read as terrain | `levelFileElements` / parser: read `data-motion` on ancestor `<g>` | ride |
| `level` | `LevelDefinition` has no movers | add `movers` + normaliser | ride |
| `content-catalog` | defaults (cellSize, items) | motion defaults + limits | ride |
| `src/shared/utils` | shape geometry | `motionPose` (role name) | new file |
| `level-kit` (feature) | generates LEVEL_PROMPT from format/catalog/tunables | moving-parts section + example | ride |
| `public/level-kit/v2` | static preview, legend, grid | animate + sweep ghost | ride |
| `documentation/game/LEVEL_FORMAT.md` | § 5 `<g>` grouping only | new § Moving parts, W-codes | ride |

## Size
M — 7 edges, all on the authoring side; no runtime systems.
Cut into laps: lap B "Moving parts move in the game" (kinematic bodies, ride/push/crush, rockets/crates, render + outline, juice) — after the terrain chain's collision-on-field lap lands.

## Decisions
DECISIONS.md D1–D16.
