# content-catalog

## Purpose

The one registry of content IDs a level may reference (materials, colours, effects, sounds, behaviors, items) and of the level defaults. Typed, keyed by stable kebab-case IDs, and exportable as plain JSON in the shape of the level kit's `catalog.json` (`documentation/game/LEVEL_FORMAT.md` § 6, § 9).

## Structure

| Layer    | Path                            | Purpose                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types    | `types/contentCatalog.types.ts` | `ContentKind`; entry types (all `id`, `label`; `MaterialEntry`: toughness (`null` = unbreakable; blast-power D1, D2), friction, bounce, `surface` (plain / ice, from `src/shared/types/terrainSurface.types.ts`), `defaultColor`, default `effect` and `sound` IDs; `ColorEntry`; `ItemEntry`: `use` drop / collectible); `CatalogDefaults`; `ResolvedEntry`; `ExportedCatalog`                                                 |
| Services | `services/contentCatalog.ts`    | `CONTENT_CATALOG`; `CATALOG_DEFAULTS` (cellSize 4 = terrain sample spacing, terrain-field D1; gravity 1, matchDuration from the tunables, material → stone, drop items, collectible item); `FALLBACK_IDS`; `LEVEL_FORMAT_VERSION`; `resolveCatalogEntry(kind, id)` → `{ entry, isFallback }`; `hasCatalogEntry`; `exportCatalog()` → `{ formatVersion, defaults, material[], color[], effect[], sound[], behavior[], item[] }`; `LEVEL_FORMAT_VERSION` = 2 |
| API      | `api/contentCatalogApi.ts`      | Public seam                                                                                                                                                                                                                                                                                                                                                                                                     |

Starter IDs: materials `stone` (solid), `earth` and `cardboard` (breakable), `ice` (solid, friction 0.12); colours `plum`, `slate`, `cardboard`, `clay`, `moss`, `mint`, `frost`, `rose`; effects `none`, `dust-burst`; sounds `none`, the material sounds `thud` (stone), `crumble` (earth), `thwap` (cardboard), `clink` (ice) and the game SFX `jump`, `land`, `tumble-bounce`, `dive-launch`, `dive-impact`, `hit`, `elimination`, `rocket-fire`, `explosion`, `pickup`, `respawn`, `round-start`, `round-end` (files in the sound feature's bank); items `rocket-launcher` (drop), `homing-launcher` (drop), `point-orb` (collectible), `dive-reset` (collectible: the headbutt reset, placed not dropped); no behaviors yet.

Seams for later work:

- **New content:** add an entry here (ID = key, never renamed or reused once shipped), run `pnpm level-kit:sync` (kit `catalog.json` + ID tables; CI fails until you do), a new colour also needs its swatch in `src/shared/config/gamePalette.ts` (`terrainSwatches[id]`) and DESIGN_LANGUAGE § 1; a new material with new behaviour needs its own surface pattern (DESIGN_LANGUAGE § 2 rule); its sound files in `features/sound/services/soundBank.ts` (+ `public/audio/sfx/`), its effect in the effects layer.

## Dependencies

- `src/shared/config/gameTunables.ts` (default match duration). Imports no game feature.
- Consumed by `level` (normalisation), `level-file` (importer, kit export) and `arena` (material behaviour and look).

## Decisions

- Breakable materials draw as plain slabs like stone (`surface: "plain"`); the `"breakable"` seam-grid surface is gone (owner, terrain-curves D5). Surfaces left: plain, ice.
- One catalog for all content kinds; breakability comes from the material alone (no terrain roles) and colour is its own kind, free on any material (owner, material-system D1, D5). `dirt` retired without alias in the format-2 bump (D6).
- Field names follow the level kit's `catalog.json` so the file is generated from code (game-engine-foundation D13).
- Lookups use own keys only, so prototype names (`toString`) are unknown IDs.
