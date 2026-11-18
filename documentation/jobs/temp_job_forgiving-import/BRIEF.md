# Brief — forgiving-import

Job: `temp_job_forgiving-import` · branch `claude/forgiving-import` · size S · from level-direction D3 (PR #61).

## Problem

The importer rejects files the game could run (no drop point, a missing viewBox, one broken attribute). The owner wants an odd but playable level to load as written, and an author's AI to be able to read whatever is left.

## Success check

1. A deliberately odd file (no viewBox but `width`/`height`, no bounds, one spawn, no drop, one shape with `width="10px"`) loads with warnings and plays.
2. A file the game can't run (no terrain) is still rejected with a readable error.
3. The lobby's import report has a **Copy report** button that copies the file name, the outcome and each issue (code + message) as plain text.

## Rule pass (LEVEL_FORMAT § 7)

| Rule | Now | Becomes | Fallback |
|------|-----|---------|----------|
| E1 | no root, or several | **error** only when there is no root; several → **W15** | the first root |
| E2 | bad or newer version | **error** when newer than the game or older with no migration (never guessed, § 8); not a whole number → **W16** | read as the game's version |
| E3 | bad viewBox | **error** only when no size can be found; otherwise **W17** | `0 0 x+W y+H` for an offset viewBox, else the root's `width`/`height`, else the bounds rect's far corner |
| E4 | not exactly one bounds inside the viewBox | retired → **W18** | none: the world; several: the first; sticking out: clipped to the world |
| E5 | fewer than 2 spawns | **error** only when there is no spawn and none can be placed; 0 → **W19**; 1 → **W6** (shared) | up to 4 spawns a spawn-lift above the top of the widest terrain shapes, inside bounds and out of terrain |
| E6 | no terrain | stays **error** | none: nothing to stand on, and no place for fallback spawns |
| E7 | no drop | retired → **W20** | no weapon crates on this level |
| E8 | bad geometry attribute | retired → **W21** | the element is ignored (like W2); its loss can still lead to E5/E6 |

Codes stay stable: retired E numbers are not reused; new warnings take W15–W21.

## Copy import report

- Lives in the import report alert under "Load level" (`LevelImportControl`), not on the level picker card, so the file-handle thread's carousel is untouched (told via the orchestrator).
- Look: the existing small ghost Copy button (same as "Copy AI prompt"), so no options page.
- Text: `Bompers level import report`, file name, `Loaded with N warning(s)` / `Rejected`, then `- CODE message` per line, errors first.

## Edges

- In: `src/features/level-file/**`, the spawn-lift constant shared with `level-kit` (one home), `useClipboardCopy` moves to `src/shared/hooks/` (2 features use it), `LEVEL_FORMAT.md` § 7, the generated prompt (`pnpm level-kit:sync`), the engine's normalisation spawn note (warns only at 0, the file warns at 1).
- Out: preview.js soft checks (warnings only already), the level picker, `app-tasks.json`.

## Plan (as built)

1. Acceptance tests in `levelFileParser.test.ts` (odd file loads with W15–W21; no-terrain file still E6; the kit's `forgiving-test-level.html` loads with exactly the warnings its comment lists).
2. Importer: geometry E8 → W21; root E1/E2/E3 fallbacks; bounds, spawns, drops fallbacks; `spawnLift` moved from the prompt into `levelFileGeometry.ts` (one home, the prompt imports it).
3. Report text `formatLevelImportReport` in `levelFileIssues.ts` (folded into existing files: services stays within its 10-file budget), hook `useImportReportCopy`, button in `LevelImportControl`. `useClipboardCopy` moved to `src/shared/hooks/`.
4. Docs: § 1 principle 4, § 7 tables (also mended a blank line that split the warnings table), § 9 row, READMEs, `pnpm level-kit:sync` (the prompt drops "(min 2)").

## Verification

`pnpm type-check`, `pnpm lint` (no new warnings), Vitest on level-file, level, level-kit, shared/hooks, lobby (all pass), `validate:structure`, `validate:feature-size`, `arch:check`, `level-kit:check`. Not verified: the button in a real browser (owner tests on the preview).
