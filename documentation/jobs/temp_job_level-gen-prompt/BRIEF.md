# Brief — Copyable level-generation prompt

Task: Copyable level-generation prompt · Lap: temp_job_level-gen-prompt · Orchestrator run `run:bompers-game-2`

## Problem
Players who want their own map must paste the format spec into an AI agent by hand. Feedback round 2 § 2.1 asks for a one-click copy button next to "Your level" that copies a ready-made prompt; an external AI (e.g. Gemini) turns it into a valid, playable level file in one shot. The owner's example (`documentation/game/LEVEL_PROMPT_EXAMPLE.md`) is written against format v1 and is stale.

## Success check
`buildLevelPrompt()` returns the full prompt (sections 1–7 of the owner's structure) whose every game-dependent value — format version, default settings, catalog IDs and colour hexes, material toughness, gravity and jump / dive / wall-jump / blast metrics, spawn minimums, dive-reset timing — comes from the live code, so changing a tunable or catalog entry changes the prompt text. The lobby's "Your level" row has a "Copy AI prompt" button that puts that text on the clipboard and says so. The kit hosts the same text at `/level-kit/v2/LEVEL_PROMPT.md`, kept in sync by `pnpm level-kit:sync` / `:check`. The minimal example level the prompt embeds parses with no errors and no warnings.

## In scope
- `level-file/services/levelPrompt.ts`: pure `buildLevelPrompt()` — sections 1 file contract, 2 coordinates and SVG subset, 3 roles, 4 catalog IDs (reuses the kit's catalog table), 5 physics and jump metrics (derived from `DEFAULT_GAME_TUNABLES` + `blastPower` utils), 6 validation checklist, 7 an empty map-request section the user fills in.
- Kit: `public/level-kit/v2/LEVEL_PROMPT.md` generated through `LEVEL_KIT_FILES` (whole file, drift-checked).
- UI: "Copy AI prompt" button beside "Load level" in `LevelImportControl`, with copied / failed feedback; small clipboard hook in `level-file/hooks/`.
- Docs: level-file README, LEVEL_FORMAT.md § kit files, AUTHORING.md pointer, LEVEL_PROMPT_EXAMPLE.md note that the live prompt replaced it.

## Out of scope
- Will NOT do: a form to fill in settings before copying (owner picked A, D1); calling an AI from the app; a prompt in other languages.
- Will NOT touch: the level format, parser rules, catalog, tunables, lobby menu rows/navigation.

## Edges
| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| `level-file` services | `levelKitExport` builds catalog.json + ID table | new `levelPrompt.ts`; `LEVEL_KIT_FILES` adds LEVEL_PROMPT.md | ride |
| `level-file` components/hooks | `LevelImportControl` = Load level button + report | add copy button + clipboard hook | ride |
| `public/level-kit/v2` | AUTHORING.md, catalog.json, preview kit | generated LEVEL_PROMPT.md | ride |
| `shared/config` + `shared/utils/blastPower` | tunables / blast math | read only | ride |

Build amendment (D6): the prompt, kit export and button moved to a new `level-kit` feature (feature budget); `lobby` (LobbyMenu "Your level" row) renders the button. Edges added: `level-kit` (new), `lobby` (ride).

Overrun rule (skill-loop D51): a diff that touches a feature area not in this table stops the lap.

## Size
S — one feature (`level-file`), one new pure service, one button, one generated kit file. No sim change.

## Plan
Acceptance test: `src/features/level-file/services/levelPrompt.test.ts` (prompt values follow tunables / catalog; embedded example parses clean; kit file in sync).

1. `levelPrompt.ts` + test: sections built from `LEVEL_FORMAT_VERSION`, `DEFAULT_LEVEL_SETTINGS`, `exportCatalog`, `renderCatalogIdTable`, `terrainSwatch`, `DEFAULT_GAME_TUNABLES`, `blastReach` / `blastPushAt` / `craterReach`; spawn minimums exported from the parser. Gate: `pnpm test:run src/features/level-file`, `pnpm type-check`.
2. Kit file: add `LEVEL_PROMPT.md` to `LEVEL_KIT_FILES`; `pnpm level-kit:sync`. Gate: `pnpm level-kit:check`, `pnpm validate:structure`.
3. UI: `useClipboardCopy` hook + button in `LevelImportControl`. Gate: `pnpm lint`, `pnpm arch:check`.
4. Docs + README decisions. Gate: `pnpm validate:feature-docs`.

## Decisions
DECISIONS.md D1–D5.
