# Brief — Terrain distance field + crater on the field

Task: Fire work lap a2 (orchestrator run `run:bompers-game-2`, thread `fire-design`) · Lap: temp_job_terrain-field · Harness: v0.45.0
Decisions carried in: blast-power D17–D20 (`documentation/jobs/temp_job_blast-power/DECISIONS.md`, merged in #44): D18 owner "field with real curves", D19 lap order, D20 falling-parts constraint.

## Problem
Terrain is 8-unit on/off cells, so craters and slopes can only follow cell edges; the curved renderer (a2r) and collision on the curve (a3) need a true distance to the surface per sample, at a finer spacing.

## Success check
A level's terrain loads as ~4-unit samples that each carry a signed distance to the nearest terrain edge (positive inside, within one sample of the true value from the level's shapes); a blast lowers the distances so the crater rim lies on the curve `shape distance = reach ÷ toughness` (round shape), and a sample is solid exactly while its distance is positive; every write goes through one write path that reports the box it touched; unbreakable samples are marked anchored at load.

## In scope
- Sample spacing 4 (catalog default and shipped levels; level files keep `data-cell-size`, meaning sample spacing).
- Grid gains `distance` (Float32, world units, clamped to a band) and `anchored` (Uint8) per sample; one write function for slot + distance.
- Import seeds the distance from the level's vector shapes (signed distance per shape, union = max).
- `clearCrater` lowers the distance with the weapon's crater shape (round slot on each weapon) and clears a sample when its distance reaches 0; reports the touched box.
- Today's solid / surface / friction queries and the renderer keep working on the finer samples (stopgap until a2r / a3).
- Docs: arena, combat READMEs; LEVEL_FORMAT cell size; kit regen.

## Out of scope
- Will NOT do: curved drawing (a2r), collision on the distance (a3), falling loose parts (later lap, D20), fire, crater shapes other than round.
- Will NOT touch: blast power maths, player controller, damage, level file roles.

## Edges
| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| arena | raster → slot cells; `clearCrater` per-cell rule; renderer slabs clipped by cells | grid gains distance + anchored; one write path; crater on the distance | ride |
| shared/utils | `shapeContains` | `shapeSignedDistance`; crater shape distance | ride |
| combat | `explode` → `clearCrater(reach)` | passes the weapon's crater shape | ride |
| shared/config + types | weapon tunables | `craterShape` per weapon | ride |
| content-catalog | `CATALOG_DEFAULTS.cellSize` 8 | 4 | ride |
| public/levels, kit, LEVEL_FORMAT | `data-cell-size="8"` | 4; regen | ride |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size
M — arena storage + import seeding + crater rewrite, a shared geometry helper, level / kit updates.
Cut into laps: none new (a2r, a3, fire, torch already queued).

## Decisions
DECISIONS.md.
