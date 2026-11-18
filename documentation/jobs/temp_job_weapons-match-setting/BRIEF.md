# Brief — weapons-match-setting

Source: level-direction D6, D7, D1 (`documentation/jobs/temp_job_level-direction/DECISIONS.md`). Size: **S–M**.

## Problem

Which weapons a crate holds is listed per drop point (`data-items`). Old maps never get new weapons, and a test map must repeat a list on every drop. Weapons should be a match setting like the match length.

## Success check

- With no level default and the lobby on "All weapons", crates on any built-in level cycle through every weapon the game has (rocket launcher, homing launcher, torch, freeze ray).
- The lobby can narrow it to one weapon or none; "none" means no weapon crates fall.
- A level's `data-weapons` (e.g. `torch`, or `none`) wins over the lobby, as `data-match-duration` does, and the lobby says so.
- `data-items` is gone from the format, importer, kit preview, prompt, docs and built-in levels; a leftover one gets the usual unknown-attribute warning (W10).

## In scope

- Sim: `tunables.match.weaponIds` (default = all weapon IDs); crates take the next weapon of that list (round-robin over all crates, homing-missiles D4 alternation kept).
- Level: `LevelSettings.weaponIds?`; root attr `data-weapons` (space-separated weapon IDs or `none`); importer, normalizer, precedence through `applyLevelSettings`.
- Drops: `LevelDrop = { at }`; remove `readDropItems`, `CATALOG_DEFAULTS.items.drop`, `data-items` everywhere.
- Lobby: weapons setting in `MatchSettings` (off set), a Weapons row after Match length with one crate toggle per weapon (owner pick D5), in-row pad cursor (D7), locked level default (D6).
- Prompt: one line for `data-weapons` in root attributes (D1 standing rule); regenerate `LEVEL_PROMPT.md` via `pnpm level-kit:sync`.

## Out of scope

- Per-drop weapon lists or any per-element override (D4, D7).
- Weapon balance, new weapons, crate schedule numbers.
- Forgiving import (separate task), copy import report.

## Edges

| Area | Change |
|---|---|
| `shared/config/weaponItems`, `shared/config/gameTunables` | all-weapon list; `match.weaponIds` |
| `level` | settings type, normalizer, drop type |
| `level-file` | root setting, drop reading, tests |
| `collectibles` | crate weapon choice |
| `match` | `applyLevelSettings` |
| `lobby` | settings, menu row, view note |
| `content-catalog`, `level-kit` | defaults, prompt, export |
| `public/levels`, `public/level-kit/v2` | built-in levels, preview.js, AUTHORING.md, LEVEL_PROMPT.md |
| `documentation/game` | LEVEL_FORMAT, LEVEL_PROMPT_EXAMPLE |

## Plan (S)

1. Acceptance tests: crates cycle `tunables.match.weaponIds`; empty list spawns none; `data-weapons` parses (ids, `none`, unknown → W4); level weapons override lobby.
2. Sim + format + drop removal; built-in levels and kit files; prompt sync.
3. Lobby row after the owner's pick.
4. Docs: LEVEL_FORMAT, feature READMEs.
