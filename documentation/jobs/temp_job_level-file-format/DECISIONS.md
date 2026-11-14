# Decisions — level-file-format

Job: `temp_job_level-file-format`
Updated: 2026-11-14

## Closed

| id | topic | status | choice | source | notes |
|----|-------|--------|--------|--------|-------|
| D1 | Container | closed | One HTML file, one inline `<svg>` root carrying the format version | orchestrator (settled) | |
| D2 | SVG subset | closed | `rect`, `polygon`, `circle` (+ untransformed `g` for grouping, `title`/`desc`/`text` ignored). No `path`, `ellipse`, `line`, `polyline`, no `transform`, no `use` | loop-refine | clear-winner for parse simplicity: rect/circle are closed-form, polygon is a plain point list; `path` needs a d-parser with arcs and curve flattening, and agents emit inconsistent paths. Rejected: allow path (most expressive) |
| D3 | Coordinates | closed | 1 SVG unit = 1 world unit; `viewBox="0 0 W H"` is the world; origin top-left, y down (SVG and PixiJS native) | loop-refine | clear-winner: no flip, no unit conversion |
| D4 | Terrain grid | closed | Root `data-cell-size` (world units per cell, default from catalog/engine); a cell is solid when its centre is inside a terrain shape | loop-refine | centre-sampling is the standard deterministic rasteriser rule. Pending engine alignment of the default |
| D5 | Presentation vs data | closed | `fill`/`stroke` are visual only; the game reads roles and IDs | orchestrator (settled) | offline picture comes from presentation attributes; kit CSS overrides them |
| D6 | Gravity setting | closed | Multiplier of the engine default (`data-gravity="1"`) | loop-refine | clear-winner: agents can't know engine units |
| D7 | Authoring guide home | closed | `public/level-kit/v1/AUTHORING.md` (served at `/level-kit/v1/AUTHORING.md`), linked from `LEVEL_FORMAT.md` | loop-refine | one file, reachable in repo and hosted. Rejected: copy in documentation/ (two copies drift) |
| D8 | Overlapping terrain | closed | `platform` wins over `destructible`; same role → later in document order sets material | loop-build | clear-winner: indestructible must stay indestructible; document order is what the picture shows |
| D9 | ID lifecycle | closed | IDs never renamed or reused; retired IDs keep a catalog alias | loop-build | clear-winner: files outlive catalog changes ("connect flawlessly"); renames are not format migrations |
| D10 | When the version bumps | closed | Only breaking changes; new IDs/attributes/roles are additive and warn on older games | loop-build | clear-winner: matches "unknown warns, never crashes"; avoids migration churn |
| D11 | Kit validation strictness | closed | Preview script runs a soft subset and lists problems; never blocks rendering | loop-build | the importer is the authority |

## Open

| id | topic | status | options briefly | blocked phase |
|----|-------|--------|-----------------|---------------|
| O1 | Whitelist `public/level-kit/v1/` | open | orchestrator/owner approval of `projectStructure.config.cjs` change | ship |
| O2 | Vocabulary alignment with engine `LevelDefinition` | open | orchestrator | spec |
| O3 | Canonical hosted origin for absolute kit URLs | open | orchestrator | spec |

## Log
