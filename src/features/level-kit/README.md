# level-kit

## Purpose

The material that teaches outside authors and AI agents to write Bompers level files, generated from the game code so it never goes stale: the copyable AI prompt ("Copy AI prompt" in the lobby's "Your level" row) and the generated parts of the public kit under `public/level-kit/v2/`. Reading and importing level files stays in `level-file`; this feature only describes the format to the outside.

## Structure

| Layer      | Path                                   | Purpose                                                                                                                                                                                                                                                                       |
| ---------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Services   | `services/levelPrompt.ts`              | `buildLevelPrompt(tunables?)`: the level-generation prompt in the owner's 7-section shape (`documentation/game/LEVEL_PROMPT_EXAMPLE.md`). Sections 1–6 come from the format version, catalog, level defaults, spawn minimums, palette and tunables (jump, dive, wall, blast power per weapon, crater per toughness, the torch and fire spread rules for cardboard; fire-spread b1); section 7 is the player's map wish. Embeds a minimal level that imports clean (tested). `LEVEL_KIT_ORIGIN` |
| Services   | `services/levelKitExport.ts`           | Kit `catalog.json` (colours carry their palette hex for the preview; materials carry `toughness`, `null` = unbreakable, and the ID table states "toughness 0.7" / "unbreakable", blast-power D21), the catalog ID table (between `<!-- level-kit:catalog-ids:… -->` markers in AUTHORING.md and LEVEL_FORMAT.md) and `LEVEL_PROMPT.md` (whole file); `planLevelKitSync(read)` |
| Hooks      | `hooks/useLevelPromptCopy.ts`          | `useClipboardCopy` (`src/shared/hooks/`, shared with level-file's report copy) bound to `buildLevelPrompt`                                                                                                                                                                                                                                |
| Components | `components/CopyLevelPromptButton.tsx` | "Copy AI prompt" ghost button; label turns to "Prompt copied" / "Copy failed"                                                                                                                                                                                                 |
| API        | `api/levelKitApi.ts`                   | Public seam                                                                                                                                                                                                                                                                   |

Kit sync: `pnpm level-kit:sync` writes the generated files; `pnpm level-kit:check` (CI `test` job) fails when they differ from the code. Script: `scripts/sync-level-kit.mjs` (loads `levelKitExport.ts` through Vite).

## Dependencies

- `content-catalog` (`exportCatalog`, `CATALOG_DEFAULTS`, `LEVEL_FORMAT_VERSION`) and `level-file` (`MIN_SPAWNS`, `RECOMMENDED_SPAWNS`; `parseLevelFile` in the prompt test) through their `api/` files.
- `src/shared/config/gameTunables.ts`, `src/shared/config/gamePalette.ts`, `src/shared/utils/blastPower.ts`, kit UI `Button`.
- Consumed by `lobby` (`CopyLevelPromptButton` in the "Your level" row) and `scripts/sync-level-kit.mjs`.

## Decisions

- Material notes and the prompt say breakable terrain looks like any slab in the game (terrain-curves D5); the preview's dashed outline for breakable terrain stays as an authoring aid.
- The copy button copies the full prompt with every game-dependent number filled in live; the player only writes the map wish at the end. Not a short settings block with a linked spec, not a fill-in form (owner, level-gen-prompt D1).
- One builder: the app copies `buildLevelPrompt()` directly (no fetch), and the sync writes the same text to `/level-kit/v2/LEVEL_PROMPT.md` (level-gen-prompt D2).
- Clipboard through the browser API, no package; the text is built on click (level-gen-prompt D3).
- The prompt names the production kit origin (`LEVEL_KIT_ORIGIN`, level-file-format D14), not `location.origin`, so the generated file is deterministic (level-gen-prompt D5).
- Split from `level-file` when the prompt pushed its services past the feature budget: describing the format to the outside is its own reason to change (level-gen-prompt D6).
- Moving parts are a `### Moving parts` block inside § 3 of the prompt (keeps the owner's 7-section shape), with the grammar, defaults, limits from `src/shared/utils/levelMotion.ts` and a worked `svg` snippet that imports with no motion warnings (tested). `preview.js` animates `<g data-motion>` with a CSS transform (the transform attribute stays forbidden) and draws dashed ghosts at the far poses; its grammar and pose maths are the marked second copy of `levelMotion.ts` (moving-parts D3, D9).
- The moving-parts block also teaches the optional part sounds (`data-move-sound`, `data-end-sound`), since an author sets them; the worked swing example uses `data-end-sound` (moving-parts B2). The crush rule stays out of the prompt: it is game behaviour, not something the author sets (owner level direction, #61).
- Movement metrics give the jump + dive reach twice: from a run and jumping out of a fast roll (the roll carry, `carriedRun`), so authors can size a gap that needs the roll (owner, bobsled-run-roll).
- Drops carry no items; the prompt teaches the optional root `data-weapons` in one line (leave it out for every weapon), because an author can set it (level-direction D1, D6). `preview.js` flags a leftover `data-items` and non-weapon IDs in `data-weapons`.
- Prompt numbers from the ability-levels lap (owner, via orchestrator, 2026-11-18): the jump + dive reach is generated from the tunables by a small model (`jumpDiveReach`: run until the dive, windup, straight dive, fall at the exit speed; it gave 744 where the sim measured 738), stated for a dive at the top of the jump and for the best late dive. The moving-part rule says touching is allowed anywhere in the cycle and gives the crush gap (`player.width × crushGapFraction`); the old 8-unit margin line contradicted the importer and the crusher test level.
- The prompt's moving-parts rule says blasts never break a part and a part of a burning material burns away (mover-materials D2, lap 2a): a part's material is now something an author chooses, so the prompt changed (level-direction D1). The fire test level carries a cardboard lift and a cardboard spinner to try it.
