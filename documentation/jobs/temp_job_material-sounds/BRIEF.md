# Brief — Material collision sounds

Task: Material collision sounds · Lap: temp_job_material-sounds · Branch: `feat/material-sounds`

## Problem
Terrain is silent: the catalog's `thud` and `crumble` have no files, so blasting earth or cardboard and headbutting any wall sound the same (or nothing), and each material should sound like itself.

## Success check
On the PR preview, a dive bonk into stone, earth, cardboard and ice each plays that material's picked sound (on top of the bonk body sound), and blasting earth or cardboard plays its own destroy sound; nothing new is wired that the owner did not approve on the listening page.

## In scope
- One sound per material, used for both impact (dive wall bonk) and destroy (blast): stone thud, earth crumble, cardboard thwap, ice clink/crack (D1).
- Test batch per DESIGN_LANGUAGE § 8 (palette row "Terrain", explicit durations, post-processed as in game) plus the four `dive-impact-spare-*` takes as candidates.
- Listening artifact: every take, each material as heard in game (body + material layer), and the owner's A/B: headbutt-into-wall sound ⇄ jump-landing sound.
- After the owner's picks: files in `public/audio/sfx/`, bank entries, catalog sound IDs (new IDs only for new materials' sounds), `pnpm level-kit:sync`, dive-bonk cue carries the bonked material, GAME_JUICE moment ledger rows.

## Out of scope
- Will NOT do: separate impact vs destroy sound fields per material (catalog schema change) — deferred; landing / footstep sounds per material — deferred.
- Will NOT touch: material behaviour (toughness, friction, durability — blast-power lap), dive sim and level format (headbutt-reset lap), music.

## Edges
| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| content-catalog | material `sound` → `thud` / `crumble` (silent) | material rows' `sound` value + new sound IDs | ride — value edits only |
| sound | `terrainDestroyed.soundId` → cue (no file → silent); bonk → `dive-impact` | `soundBank.SOUND_FILES`, `soundCues` bonk rule reads a material sound | ride |
| match | `soundSnapshotOf` flattens dive state | adds the bonked material's sound ID to the player snapshot (probe terrain at the bonk frame) | ride |
| arena | `getCellInfo` gives a cell's material | read-only use | ride |
| public/audio/sfx | game SFX files | new material takes | ride |
| documentation/game | § 8 palette, GAME_JUICE ledger, LEVEL_FORMAT catalog table (kit sync) | rows | ride |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size
S — four existing areas ridden, no schema change; most of the lap is generation and owner listening.
Cut into laps: none.

## Decisions
DECISIONS.md D1…
