# level-memory

## Purpose

Remembering imported levels in this browser so they survive a reload: a saved copy (the file text) in IndexedDB for every browser and, on Chrome and Edge, a link to the file on disk through the File System Access API, so editing the file shows up in the game. It stores and reads; parsing stays in `level-file`, which owns the level library and calls this feature.

## Structure

| Layer    | Path                         | Purpose                                                                                                                                                                                                                                                             |
| -------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types    | `types/levelMemory.types.ts` | `LevelRecord` `{ levelId, fileName, text, lastModified, savedAt, handle? }`, `LevelStore` port (`list` / `put` / `remove`), `LinkedRead`, `PickedFile`                                                                                                              |
| Services | `services/levelStore.ts`     | `createIndexedDbLevelStore` (database `bompers-levels`, object store `imported`, keyPath `levelId`), `createMemoryLevelStore` (tests, fallback), `createBrowserLevelStore` (IndexedDB, falls back to memory for the session when it is blocked; never rejects)      |
| Services | `services/levelFileLink.ts`  | `canLinkFiles`, `pickLinkedFile` (native picker), `readIfChanged(handle, lastModified)` (never asks, never throws: changed / unchanged / needsPermission / missing), `relinkFile` (permission request, needs a click), `droppedFileHandle` (Chromium drag-and-drop) |
| API      | `api/levelMemoryApi.ts`      | Public seam                                                                                                                                                                                                                                                         |

## Dependencies

- None of the game features. Browser APIs: IndexedDB, File System Access (Chromium; missing parts declared locally in `levelFileLink.ts`, no `@types` package).
- Consumed by `level-file` (`useLevelLibrary` and its hooks; `LevelImportControl` for the picker) and `lobby` (`droppedFileHandle` in the drop handler).

## Decisions

- Two tiers in one code path (owner, 2026-11-18, "browser agnostic"): every browser keeps a saved copy keyed by level id; Chrome and Edge also keep the file handle in the same record. Any link failure (permission refused, file moved) falls back to the copy.
- The record stores the file text, not the parsed level, so a parser or format migration change applies to old copies on the next load (level-file-handle plan).
- No storage package (`idb-keyval`, `fake-indexeddb`) and no `@types/wicg-file-system-access`: one object store is a few lines, and tests use the memory store through the `LevelStore` port.
- `navigator.storage.persist()` is not called (some browsers prompt). A browser under storage pressure can evict the copies; they then just disappear from the strip.
