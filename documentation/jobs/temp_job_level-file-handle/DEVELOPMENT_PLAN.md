# DEVELOPMENT_PLAN — level-file-handle (remember imported levels)

Status: planned, **blocked**. No edits to `src/features/level-file/**`, `src/features/lobby/**` or `src/shared/hooks/useFileDrop.ts` until the orchestrator clears it, after weapons-match-setting lands. The plan must be rebased onto that work before Phase 1. Size **M**, one lap with two tiers. The size-M plan review runs at clearance, against the rebased code.

Scope (orchestrator, 2026-11-18, the owner's question "can we make it browser agnostic?"):

- **Tier 1, every browser: saved copy.** Each accepted import is kept in IndexedDB, keyed by its `levelId`, so it survives a reload. Importing or dropping a file with the same `levelId` replaces that entry in place. The edit loop is "save, drop again".
- **Tier 2, Chrome and Edge only: file link.** "Load level" uses `showOpenFilePicker`, and the `FileSystemFileHandle` is stored next to the copy. The file is re-read on window focus and at match start when `lastModified` changed. After a reload, one click relinks it (the permission prompt). Any failure falls back to the copy.

UI (owner, 2026-11-18): a thumbnail carousel instead of the round-1 options. Imported levels are shown as cards with a small render of the level's layout, each with its state and Forget / Relink. Options page round 2: https://claude.ai/artifact/V4XSZVdpyh8Jd4ghpctD1A (variant 1, recommended: a strip of every level with a "Load level" card at the end; variant 2: a spotlight with peeking neighbours). Phase 3 waits for the owner's pick.

## Conflict with a recorded decision

`level-file` README and lobby D1: "every accepted import (even the same file again) is a new library entry". Tier 1 replaces that with "same `levelId` replaces in place; a new `levelId` adds an entry". **Resolved (owner, 2026-11-18):** same level id replaces its entry. Phase 1 rewrites the README and lobby D1 line, citing the owner, 2026-11-18.

## Design

- **One store port, no new dependency.** The new `services/levelStore.ts` (role: persistence of imported levels) holds `LevelStore { list(), put(record), remove(levelId) }`, with an IndexedDB implementation (one database, one object store, keyPath `levelId`; about 40 lines, hand-written) and an in-memory implementation for tests and as the fallback. `fake-indexeddb` and `idb-keyval` would both be new dependencies, which this design avoids.
- **Record:** `{ levelId, fileName, text, savedAt, handle? }`. It stores the file text, not the parsed `LevelDefinition`, so a parser or migration change re-parses on load and the copy stays the source. A `FileSystemFileHandle` is structured-cloneable in Chromium, so it can sit in the same record.
- **Library ids:** an imported entry's id becomes `import:<levelId>` (was `import:<n>`), stable across reloads. A collision with a built-in is impossible, because built-in ids are URLs.
- **Hook:** `useLevelLibrary` loads `store.list()` once at start (a TanStack query, `staleTime: Infinity`, like the built-ins) and parses each record. A record that no longer parses is skipped and logged under the debug flag, not deleted. `importFile` puts the record and replaces in place. A new `forget(id)` removes the record.
- **Storage unavailable** (private window, blocked site data): fall back to the in-memory store. Import works as it does today, without an error.
- **Tier 2 module:** `services/levelFileLink.ts` (role: linking a level to its file on disk). It holds `canLinkFiles()` (feature detection), `pickLinkedFile()`, `readIfChanged(handle, lastModified)` and `relink(handle)` (`requestPermission`, called only from a click). Ambient types for `showOpenFilePicker` and `FileSystemHandle.queryPermission/requestPermission` go in a local `.d.ts`, so no `@types/wicg-file-system-access` dependency.
- **Re-read trigger:** a `focus` / `visibilitychange` listener in the hook re-reads the linked entries. The swap applies only while the lobby is shown; during a match it waits for the next match start. A changed file whose new text fails to parse keeps the old copy and shows the import report with its errors.
- **Drag and drop (Chromium):** `useFileDrop` gains an optional `onHandle` callback through `DataTransferItem.getAsFileSystemHandle()`, so dropped files link too. This is a shared hook, so the change has to stay generic (role name, no level wording).

## Phases

1. **Acceptance test first (red):** `useLevelLibrary.test.ts`, given the in-memory store.
   - "should keep an imported level when the library is created again with the same store"
   - "should replace the entry when a file with the same level id is imported"
   - "should drop the entry when it is forgotten"

   Then `levelStore.ts`, the hook changes, and the README decision rewrite. Gate: targeted Vitest, type-check.
2. **Tier 2 services:** `levelFileLink.ts` plus the ambient types, and the picker branch in `LevelImportControl` (falls back to `<input>` when `!canLinkFiles()`). Focus re-read in the hook. Unit tests for `readIfChanged` with a fake handle object. Gate: targeted Vitest, type-check, `pnpm validate:feature-size` (level-file gains about 3 files).
3. **Lobby carousel (after the owner's variant pick):** a pure `LevelThumbnail` component that renders a `LevelDefinition`'s terrain (rect, polygon, circle) as SVG in the world palette: the sky gradient, swatch fill, ink outline, framed to the bounds. It is named by role and lives with the level model's consumers (placement checked against `projectStructure.config.cjs` at build). It updates when a linked file is re-read. The carousel replaces the level stepper's value and keeps the row's left / right cycle action. Down moves to the picked card's Relink / Forget. Open choice for the owner: whether built-ins share the carousel; the page assumes yes. Gate: one headless smoke run that imports a file, reloads and reads the logged library state.
4. **Drop links (optional, owner):** `useFileDrop` `onHandle`. Can move to a follow-up if the lap runs long.

## Not verified / risks

- Chrome Android behaviour and `FileSystemObserver` were not checked; the plan does not need either.
- Storage eviction: IndexedDB can be cleared by the browser under storage pressure unless `navigator.storage.persist()` is granted. The plan does not call it (that would show a prompt in some browsers). This is a known limitation: a lost copy just disappears from the list.
- Relink needs a user click (user activation). A remembered level picked with a controller plays its saved copy until someone clicks Relink.
