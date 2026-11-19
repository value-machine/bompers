# Brief — level-prompt-numbers

Job: `temp_job_level-prompt-numbers` · branch `claude/level-prompt-numbers` · size S · from PR #79 author feedback (backlog "Level prompt: remaining ability numbers").

## Problem

`LEVEL_PROMPT` § 5 lacked the numbers authors size a level by for the roll, slopes, ice, the freeze ray, leaving a moving part and the headbutt's hit.

## Success check

The prompt states them, generated from `DEFAULT_GAME_TUNABLES` (and the catalog's ice grip), and `levelPromptAbilities.test.ts` proves the stated numbers equal the tunables and follow them when they change. The committed `public/level-kit/v2/LEVEL_PROMPT.md` is re-synced (`pnpm level-kit:sync`).

## Scope and edges

- In: `src/features/level-kit/services/levelPrompt*.ts`, the synced kit prompt, the feature README.
- Out: game behaviour, tunables, player contact code (parallel thread), `app-tasks.json`.
- Per level-direction D1 the new lines state only what changes where an author places, sizes or spaces shapes.

## Plan

1. `levelPromptAbilities.ts`: pure derivations (roll coast with grip and the 6 s cap, slope roll speed, slope walk speed, brake slide, lift-jump apex, freeze patch radius) and the § 5 lines.
2. Wire into `movementLines` / `renderPhysics` / `weaponLines`; re-sync the kit; test.
