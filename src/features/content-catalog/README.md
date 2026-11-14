# content-catalog

## Purpose

The one registry of content IDs a level may reference (materials, effects, sounds, behaviors, items) and of the level defaults. Typed, keyed by stable kebab-case IDs, and exportable as plain JSON in the shape of the level kit's `catalog.json` (`documentation/game/LEVEL_FORMAT.md` § 6, § 9).

## Structure

| Layer | Path | Purpose |
|-------|------|---------|
| Types | `types/contentCatalog.types.ts` | `ContentKind`; entry types (all `id`, `label`; `MaterialEntry`: destructible, durability, friction, bounce, lookToken, default `effect` and `sound` IDs; `ItemEntry`: `use` drop / collectible); `CatalogDefaults`; `ResolvedEntry`; `ExportedCatalog` |
| Services | `services/contentCatalog.ts` | `CONTENT_CATALOG`; `CATALOG_DEFAULTS` (cellSize 8, gravity 1, matchDuration from the tunables, material per role platform → stone / destructible → dirt, drop items, collectible item); `FALLBACK_IDS`; `LEVEL_FORMAT_VERSION`; `resolveCatalogEntry(kind, id)` → `{ entry, isFallback }`; `hasCatalogEntry`; `exportCatalog()` → `{ formatVersion, defaults, material[], effect[], sound[], behavior[], item[] }` |
| API | `api/contentCatalogApi.ts` | Public seam |

Starter IDs: materials `stone` (indestructible), `dirt` (destructible); effects `none`, `dust-burst`; sounds `none`, `thud`, `crumble`; items `rocket-launcher` (drop), `point-orb` (collectible); no behaviors yet.

Seams for later work:
- **New content:** add an entry here (ID = key, never renamed or reused once shipped), run `pnpm level-kit:sync` (kit `catalog.json` + ID tables; CI fails until you do), then its look in `src/shared/config/gamePalette.ts` (`materialLooks[lookToken]`), its sound in the audio module, its effect in the effects layer.

## Dependencies

- `src/shared/config/gameTunables.ts` (default match duration). Imports no game feature.
- Consumed by `level` (normalisation), `level-file` (importer, kit export) and `arena` (material behaviour and look).

## Decisions

- One catalog for all content kinds; solid vs destructible comes from the piece's role plus the material, not a hard-coded cell kind (orchestrator).
- Field names follow the level kit's `catalog.json` so the file is generated from code (game-engine-foundation D13).
- Lookups use own keys only, so prototype names (`toString`) are unknown IDs.
