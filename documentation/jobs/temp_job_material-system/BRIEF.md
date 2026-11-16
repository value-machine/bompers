# Brief — Uniform material system for level maps

Task: owner feedback round 2 § 4.1 (orchestrator run `run:bompers-game-2`) · Lap: temp_job_material-system · Harness: v0.45.0

## Problem
Externally generated level files need unambiguous materials: today destructibility is double-coded (role `platform`/`destructible` AND material flag), only two materials exist (`stone`, `dirt`), colour is welded to the material, the two terrain kinds are drawn with different structures (slab vs honey tiles), and `friction` is in the catalog but unused.

## Success check
A level file whose terrain uses each material (solid, breakable earth, breakable cardboard, ice) in at least two colours imports without warnings; blasts clear only breakable cells whatever their colour; a blob on ice keeps sliding after input stops (ground decel scaled by the material's friction); every material draws as the same rounded slab (plum-ground structure) with a non-colour surface cue for "breakable" and for "ice".

## In scope
- Format: one material axis (behaviour bundle: destructible, friction, effect, sound, surface cue) and one colour axis (named swatch, optional, default per material) — exact shape per the owner's decouple/couple answer (DECISIONS D1).
- Catalog: materials `stone`, `earth`, `cardboard`, `ice`; swatch list; defaults; `pnpm level-kit:sync` output.
- Importer (`level-file`) + normaliser (`level`) for the new attributes; format version bump (no migration of old files — owner waived compat).
- Terrain runtime (`arena`): cell slot carries material + colour; renderer draws all terrain as rounded slabs with lip; breakable slabs are clipped to their remaining cells; surface cues (breakable seams, ice gloss).
- Player controller: grounded accel/decel scaled by the friction of the material under the feet.
- Shipped levels (`public/levels/*.html`), kit (`public/level-kit/`), `LEVEL_FORMAT.md`, `AUTHORING.md`, `DESIGN_LANGUAGE.md` § 1–2 terrain rows and the destructible/indestructible rule, feature READMEs.

## Out of scope
- Will NOT do: material collision sounds (queued lap; materials keep a `sound` ID seam), headbutt-reset power-up, copyable generation prompt (queued laps), moving/bouncy behaviours, breakable ice.
- Will NOT touch: blast radius / combat rules, camera, match rules, sound bank files.

## Edges
| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| content-catalog | `CONTENT_CATALOG.material` stone/dirt with lookToken | material entries + swatch table + defaults | ride |
| level | `TerrainPiece { role, materialId }`, normalise unknown material | piece gets `colorId`; role collapses or stays per D1 | ride |
| level-file | `readTerrainRefs` reads data-material/effect/sound/behavior | read `data-color`, roles, version | ride |
| arena | raster → slots (role, material, destructible, lookToken); renderer slab vs honey tiles | slot = material + colour; unified slab renderer with cell clip | ride (renderer rework) |
| player | `horizontalRate` ground accel/decel | scale by friction under feet | ride |
| effects / combat | debris colour via `lookToken`; `byMaterial` | debris colour from the cell's swatch | ride |
| shared/config gamePalette | `materialLooks` | swatch palette | ride |
| public/levels, public/level-kit, scripts/sync-level-kit.mjs | v1 files, kit v1 | v2 files and kit | ride |
| documentation/game | LEVEL_FORMAT, DESIGN_LANGUAGE | material + colour sections | ride |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size
M — 7 feature areas, one renderer rework, format bump, docs/kit regen.
Cut into laps: none (queued follow-ups already exist: material sounds, headbutt-reset power-up, generation prompt).

## Decisions
DECISIONS.md D1 (decouple vs couple — owner, open), D2–D4 clear winners.
