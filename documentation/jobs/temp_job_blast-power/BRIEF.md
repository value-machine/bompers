# Brief — Blast power: one number drives crater and push

Task: Fire: spreading fire, flamethrower and burn reaction — lap (a) of 3 · Lap: temp_job_blast-power · Harness: v0.45.0 · Orchestrator run `run:bompers-game-2` (thread `fire-design`)

Ideation artifact (owner-reviewed, version 3): https://claude.ai/artifact/KStEshn2kooJPfpH5C951X

Base: builds on the material system (PR #36, branch `feat/material-system`); rebase onto `main` after #36 merges. Build does not start before that.

## Problem
A blast's crater and push are fixed tunables (`combat.explosion.craterRadius` 34, `radius` 64, `impulse` 1350), so weapons cannot differ in strength and materials cannot differ in how much a blast cuts out of them (owner: "the rocket should only pick at what point it explodes and with what power; the material decides the cutout", "a scalable blast from 0 … to flying").

## Success check
With one blast power P (0–100, rocket = 50): a blast at the same point clears a circle of radius 0.68·P ÷ toughness per material (rocket: 34 units in earth, ≈ 49 in cardboard, none in stone or ice); the point-blank push is 27·P units/s with reach 1.28·P units (P 0 → no push, no crater; P 10 → 270 / 12.8; P 50 → 1350 / 64, today's values; P 90 → 2430 / 115.2), falling off as today (max(0.35, 1 − d / reach)); every existing rocket test keeps passing unchanged at P 50.

## In scope
- One blast power per blast (`Blast.power`); the rocket's power is a tunable (`combat.rocket.power` = 50 or equivalent per weapon).
- Crater by power: a per-cell test `shapeDistance × toughness ≤ craterPerPower × power` (round shape only here; written as a distance rule over sample positions so the field lap a2 reuses it at its finer resolution, D17–D19) replaces the fixed `craterRadius` circle (arena's crater function); toughness comes from the material's catalog `durability` and rides in the terrain cell slot. Unbreakable materials (`destructible: false`) never clear.
- Push by power: the blast's reach and centre push derive from power (straight line, D3); the blast still hands each pushed player `{ direction, impulse }` to `reactToHit` — the seam the shared-roll lap replaces.
- Material values: cardboard 0.7, earth 1.0; stone, ice unbreakable (D2). Kit regen (`pnpm level-kit:sync`) for the changed catalog values; AUTHORING note on toughness.
- Consumers of the old tunables: explosion event `radius` = this blast's reach; the feel/shake scale and the out-of-bounds margin read the rocket's power instead of the removed constants (same values at P 50).
- Fold the owner decisions D1–D8 into their homes (combat README, content-catalog README, `DOC_APP_VISION.md` GDD-reading table for the fire rules that govern laps b and c).

## Out of scope
- Will NOT do: the distance field, curved edges, crater shapes other than round, collision on the field (own laps after this one, D17–D19); fire, burn state, burn reaction (lap b); flamethrower (lap c); shared roll / tumble rework (separate queued lap "Shared roll"); shelter / ray absorption and partial wear (owner chose plain power ÷ toughness); breakable ice; new weapons with other powers.
- Will NOT touch: hit damage (`combat.hitDamage`), tumble threshold `player.tumble.minImpulse` and the tumble itself, rocket flight, level file format (materials stay referenced by ID; no format bump), explosion art.

## Edges
| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| combat | rocket hit → `explode(ctx, blast)` → `hitPlayers` (fixed `radius`/`impulse`/`minFalloff`) + `blastTerrain` (`clearCircle` with `craterRadius`) + `explosion` event (`radius`) | `Blast` gets `power`; one pure power→reach/push/crater module; rockets pass `combat.rocket.power` | ride |
| arena | `clearCircle(grid, circle)`: destructible cells whose centre is inside clear | crater-by-power function using per-slot toughness; `TerrainCellSlot` gains `toughness` | ride |
| content-catalog | `MaterialEntry.durability` exists, unused (0 / 1) | set cardboard 0.7, earth 1.0; document as toughness | ride |
| shared/config + types | `combat.explosion { radius, craterRadius, impulse, minFalloff }` | per-power constants (`perPower` 27, `reachPerPower` 1.28, `craterPerPower` 0.68, `minFalloff`) + `rocket.power` 50 | ride |
| match | out-of-bounds margin uses `explosion.impulse`; renderer passes `fullBlastRadius` = `explosion.radius` to feel cues | derive both from the rocket's power | ride |
| public/level-kit, documentation | kit catalog.json carries `durability`; AUTHORING lists materials | regen + one toughness line | ride |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size
M — 6 areas (combat, arena, content-catalog, shared config, match, kit/docs), a tunables reshape with all consumers, and the decision fold; logic itself is small and pure (TDD on the power module and the crater test).
Cut into laps (D19): (a2) Terrain distance field + crater on the field, (a2r) Curved terrain edge renderer, (a3) Collision on the field, (b) Fire as arrival time on the field + burn reaction, (c) Torch flamethrower — follow-ups for the orchestrator's backlog (this thread does not edit `app-tasks.json`).

## Decisions
DECISIONS.md D1–D8 owner (via orchestrator, "all recommended"), D9–D13 clear winners, D14/D15/D17 owner (smooth outline, collision on it, crater shapes), D16 lap placement; D18 owner final terrain pick (field with real curves, supersedes D14), D19 lap order (supersedes D16).
