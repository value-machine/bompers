# level-file

## Purpose

Level files in and out of the game: the importer that turns one HTML file with an inline `<svg data-level-format>` (or a bare `.svg` with the same root) into the engine's `LevelDefinition`, the built-in level source, the "Load level" control, and the generated parts of the public level kit. Format spec (SSOT): `documentation/game/LEVEL_FORMAT.md`; agent one-pager: `public/level-kit/v1/AUTHORING.md`.

## Structure

| Layer      | Path                                | Purpose                                                                                                                                                                                                                                                                                                                         |
| ---------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types      | `types/levelFile.types.ts`          | `LevelIssue` `{ code?: E1–E8 \| W1–W10, message }`, `LevelRole`, `RoleElement`, `LevelFileMigration`                                                                                                                                                                                                                            |
| Services   | `services/levelFileParser.ts`       | `LevelImportResult` (`ok` + level + warnings, or errors + warnings; declared here because it names another feature's type), `parseLevelFile(text, { toVersion?, migrations? })`: DOMParser → root → migrations → viewBox → meta / settings → role elements → terrain, bounds, points → `normalizeLevelDefinition`. Never throws |
| Services   | `services/levelFileRoot.ts`         | Root checks E1–E3, metadata (W9, level-id slug), settings (W8)                                                                                                                                                                                                                                                                  |
| Services   | `services/levelFileElements.ts`     | Role element filter (W1 unknown role, W2 wrong element, W3 transform, W7 duplicate id, W10 unknown `data-*`) and catalog references (W4 → role default)                                                                                                                                                                         |
| Services   | `services/levelFileGeometry.ts`     | Number / rect / polygon / circle / point readers (E8), rect containment                                                                                                                                                                                                                                                         |
| Services   | `services/levelFileIssues.ts`       | Issue log (errors, warnings)                                                                                                                                                                                                                                                                                                    |
| Services   | `services/levelFileMigrations.ts`   | `LEVEL_FILE_MIGRATIONS` (key N = migrate vN → vN+1, empty while v1 is the only format), `migrateLevelRoot`                                                                                                                                                                                                                      |
| Services   | `services/levelFileSource.ts`       | `BUILT_IN_LEVEL_URL` (`/levels/floating-garden.html`), `loadLevelFromUrl`                                                                                                                                                                                                                                                       |
| Services   | `services/levelKitExport.ts`        | Kit `catalog.json` and the catalog ID table (between `<!-- level-kit:catalog-ids:… -->` markers in AUTHORING.md and LEVEL_FORMAT.md), built from the content catalog + level defaults; `planLevelKitSync(read)`                                                                                                                 |
| Hooks      | `hooks/useLevelSource.ts`           | The level to play: built-in (TanStack Query fetch) until a valid import replaces it; `importFile`, last `report`                                                                                                                                                                                                                |
| Components | `components/LevelImportControl.tsx` | "Load level" button (file picker) + the report as an `Alert` (errors, or warnings)                                                                                                                                                                                                                                              |
| API        | `api/levelFileApi.ts`               | Public seam                                                                                                                                                                                                                                                                                                                     |

Messages name the element: `platform "main-core"` (id or `data-label`), else `spawn #2` (ordinal within its role, document order).

Kit sync: `pnpm level-kit:sync` writes the generated files; `pnpm level-kit:check` (CI `test` job, and pre-commit when catalog / level / kit files are staged) fails when they differ from the code. Script: `scripts/sync-level-kit.mjs` (loads `levelKitExport.ts` through Vite).

## Dependencies

- `level` (model, defaults, `normalizeLevelDefinition`) and `content-catalog` (`hasCatalogEntry`, `exportCatalog`) through their `api/` files.
- `src/shared/utils/shapeGeometry.ts` (`shapeContains`, spawn-in-terrain check), `src/shared/config/gameTunables.ts` (match duration default), kit UI `Alert` / `Button`.
- Consumed by `match` (`GameView` mounts the control and plays `useLevelSource().level`; drag-and-drop via `src/shared/hooks/useFileDrop.ts`).

## Decisions

- Built-in levels are real level files in `public/levels/*.html`, fetched at start (game-orchestration D4).
- A rejected import keeps the current level; any accepted import (even the same file again) restarts the match with a new level object (level-importer).
- Point roles carry no behaviour in the engine yet; `data-behavior` on them is only checked (W4) (level-importer).
- `x`, `y`, `cx`, `cy` default to 0 as in SVG; sizes (`width`, `height`, `r` on terrain, `points`) are required and positive (level-importer).
