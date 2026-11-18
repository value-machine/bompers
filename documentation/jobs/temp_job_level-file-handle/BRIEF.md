# BRIEF — level-file-handle (research, Stop 1)

Status: research done, waiting on the owner (one question). No app code is written. The lobby and level-file code are locked by the weapons-match-setting thread.

## Problem

Owner idea (level direction #61): keep an imported level by its file location, so that editing the file on disk shows up in the game without importing it again.

## What exists (v-main, read 2026-11-18)

- `src/features/level-file/hooks/useLevelLibrary.ts`: imports live in React state only (`useState`, ids `import:<n>`). **Nothing is stored.** A reload loses every imported level. The task text assumes "today's stored copy", but there is no stored copy to fall back to.
- `LevelImportControl.tsx` uses a hidden `<input type="file">`, and `src/shared/hooks/useFileDrop.ts` reads `dataTransfer.files`. Both give a `File` snapshot, never a handle.
- The repo uses no IndexedDB yet. `localStorage` appears only in `src/shared/theme/colorMode.ts` and `src/features/sound/services/audioEngine.ts`.

## Browser support (sources below)

| Browser | `showOpenFilePicker` + stored handle | After a reload |
|---|---|---|
| Chrome / Edge desktop 86+ | yes | stored handle; one permission prompt per visit, or none after the user picks "Allow on every visit" (Chrome 122+) |
| Chrome Android | listed as supported by caniuse | not checked |
| Firefox (desktop, Android) | no (negative standards position, unlikely to ship) | — |
| Safari macOS / iOS | no | — |

Requires HTTPS. The Cloudflare preview and production both use it.

## What the user sees (Chrome / Edge)

1. "Load level" opens the native picker (`showOpenFilePicker`) instead of the `<input>`. Nothing else changes.
2. After a reload, the remembered levels show in the picker list. The first time one is played, Chrome asks once: "Allow this time / Allow on every visit / Don't allow". Chrome only shows this prompt after a click (it needs user activation), so the first click on a remembered level asks for permission and then loads it.
3. If the file was moved or deleted, the entry shows "file not found" and offers to forget it.

Drag-and-drop can also hand over a handle in Chromium (`DataTransferItem.getAsFileSystemHandle()`). This means editing `useFileDrop`, which is shared code. It is in scope only if the owner wants dropped files remembered too.

## Picking up file changes

| Option | Cost | Note |
|---|---|---|
| Re-read on window focus and on match start: `getFile()`, compare `lastModified`, re-parse if changed (recommended) | about 10 lines, no timers | The owner saves in an editor and switches back to the game, which fires focus, so the change appears without a timer |
| Polling every N seconds | a timer and a re-read while idle | Covers a second screen without a focus change. Adds work during a match |
| `FileSystemObserver` | newer Chromium API, support not verified this lap | Push-based, but adds a second support matrix. Later, not now |
| Manual "Reload" button | one button | The fallback if the owner dislikes surprise mid-lobby reloads |

A changed file must never swap the level during a running match. It applies at the next match start, or in the lobby.

## Fallback (Firefox / Safari)

Today's behaviour, unchanged: the `<input>` picker, a session-only import, lost on reload. Storing a copy for every browser (IndexedDB holding the file text) is a separate feature. It would be the natural cross-browser half of "remember my levels". I'd propose it as a follow-up task, not this lap.

## Cost and size

- No paid service, no network calls, no server.
- Storage: one handle record per level in IndexedDB (a few hundred bytes each). The file text is not duplicated.
- Dependency: writing the IndexedDB code by hand takes about 40 lines. `idb-keyval` (under 1 kB) would be a **new dependency**, which is an owner stop, and I'd decline it (hand-written code is enough for one store).
- Types: TypeScript's DOM lib may lack `showOpenFilePicker`. `@types/wicg-file-system-access` would be another new dependency. A local ambient declaration avoids it.
- Edges: `level-file` (hook, control, a new handle-store service, README), the lobby picker rows (a "remembered" or "file not found" state), and possibly `src/shared/hooks/useFileDrop.ts`.
- **Size: S** (Chromium only: picker, handle store, re-read on focus). **M** if it also adds stored copies for Firefox and Safari.

## Owner choices still open

- Which browser the owner plays and edits levels in. It decides whether this lap pays off (see the orchestrator message).
- Options page (loop-refine step 6) before any UI code: the lobby row states (remembered, needs permission, file not found) and where the reload hint shows.

## Sources

- MDN `showOpenFilePicker`: https://developer.mozilla.org/en-US/docs/Web/API/window/showOpenFilePicker
- caniuse: https://caniuse.com/mdn-api_window_showopenfilepicker
- web-features (standards position): https://web-platform-dx.github.io/web-features-explorer/features/file-system-access
- Chrome, File System Access API: https://developer.chrome.com/articles/file-system-access
- Chrome, persistent permissions (122): https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api
