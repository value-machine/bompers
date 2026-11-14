# Brief — Level file format and preview kit

Task: Level file format and preview kit · Lap: temp_job_level-file-format · Harness: v0.44.0

## Problem
AI agents on any platform need one written contract to produce a Bompers level as a single HTML file that any browser shows and the later importer can parse without guessing.

## Success check
An agent given only the authoring guide can write a level that passes every validation rule in `LEVEL_FORMAT.md`; the kit's example level renders as a plain picture with the kit unreachable and with legend, labels and grid when the kit loads (two Playwright screenshots).

## In scope
- `documentation/game/LEVEL_FORMAT.md`: spec (root + version, roles, geometry → cell grid, SVG subset, reference attributes, settings, metadata, validation, versioning/migration).
- Agent authoring guide, one page, minimal + full example, reachable in repo and on the hosted site.
- `public/level-kit/v1/`: `preview.css`, `preview.js` (legend, labels, grid overlay), `catalog.json` placeholder with starter IDs, example level.
- Playwright screenshots online/offline.

## Out of scope
- Will NOT do: in-game parser/importer, catalog generation from code, CI drift check — later lap ("Level importer in the game").
- Will NOT do: `LevelDefinition` / catalog TypeScript types — engine-foundation thread.
- Will NOT touch: `src/**`, `src/config/app-tasks.json`, `projectStructure.config.cjs` (protected; whitelist change requested via orchestrator).

## Edges
| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| documentation/game | GDD only | new `LEVEL_FORMAT.md` beside GDD | ride — already whitelisted (`documentation/*/*.md`) |
| public/ | favicon + overview png, copied to `dist/` by Vite, served as static assets | new `public/level-kit/v1/` | new — needs whitelist entry |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size
S — docs + static kit (one small script, one stylesheet, two data/example files), no app code. Format design carries the weight; settled points are fixed by the orchestrator.
Cut into laps: none.

## Decisions
DECISIONS.md D1…Dn.

## Plan (S)
Acceptance check (manual, scripted in the scratchpad, not shipped): Playwright opens `public/level-kit/v1/example-level.html` (a) over HTTP with the kit served → legend, labels, grid present, no console errors; (b) with kit requests aborted → SVG shapes still visible, no script errors. Plus a validation pass of the example against the spec rules (small node script in the scratchpad).

1. `public/level-kit/v1/catalog.json` — starter IDs per kind with defaults.
2. `public/level-kit/v1/preview.css` — palette as CSS custom properties (neutral placeholders; design-language thread swaps them), role styles overriding presentation attributes.
3. `public/level-kit/v1/preview.js` — no deps; finds the root, adds grid pattern, point labels, legend + metadata panel, soft validation (counts, unknown IDs when catalog.json is fetchable).
4. `public/level-kit/v1/example-level.html` — start-map-shaped level, relative kit links, full presentation attributes.
5. `documentation/game/LEVEL_FORMAT.md` — the spec.
6. `public/level-kit/v1/AUTHORING.md` — one-page agent guide (minimal + full example).
7. Screenshots + validation script; check `pnpm validate:structure` (fails until whitelist O1 is approved).

Pattern & precedent: SVG-as-level-data mirrors Tiled/LDtk object layers and Inkscape-authored levels (shapes + custom attributes, engine converts to its own model); centre-sampling rasterisation matches common scanline fill rules.
