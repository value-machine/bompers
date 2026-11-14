# content-catalog

## Purpose

The one registry of content IDs a level may reference: materials, effects, sounds, behaviors and items. Typed, keyed by stable kebab-case IDs, and exportable as plain JSON so the level kit's `catalog.json` is generated from it.

## Structure

| Layer | Path | Purpose |
|-------|------|---------|
| Types | `types/contentCatalog.types.ts` | `ContentKind`, entry types per kind (`MaterialEntry`: destructible, durability, friction, bounce, lookToken, default impact / destroy sound and destroy effect), `ResolvedEntry`, `ExportedCatalog` |
| Services | `services/contentCatalog.ts` | `CONTENT_CATALOG`, `FALLBACK_IDS` (material stone, effect none, sound none, behavior / item: none = drop), `resolveCatalogEntry(kind, id)` → `{ entry, fallback }`, `hasCatalogEntry`, `exportCatalog()` |
| API | `api/contentCatalogApi.ts` | Public seam |

Starter IDs: materials `stone` (indestructible), `dirt` (destructible); effects `none`, `dust-burst`; sounds `none`, `thud`, `crumble`; items `rocket-launcher` (pickup), `point-orb` (collectible); behaviors none yet.

Seams for later work:
- **New content:** add an entry here (ID = key), run `pnpm level-kit:sync` (kit `catalog.json` + ID tables; CI fails until you do), then its look in `src/shared/config/gamePalette.ts` (`materialLooks[lookToken]`), its sound in the audio module, its effect in the effects layer.

## Dependencies

- None. Consumed by `level` (normalisation), `level-file` (importer, kit export) and `arena` (material behaviour and look).

## Decisions

- One catalog for all content kinds; solid vs destructible comes from the piece's role plus the material, not a hard-coded cell kind (orchestrator).
- Lookups use own keys only, so prototype names (`toString`) are unknown IDs.
