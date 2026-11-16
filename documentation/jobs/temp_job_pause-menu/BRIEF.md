# Brief — In-game pause menu

Task: In-game pause menu (FEEDBACK_ROUND_2 § 2.2) · Lap: temp_job_pause-menu · Harness: v0.45.0

## Problem
Players cannot stop a running match: there is no pause, and sound on/off is only reachable as volumes in the lobby.

## Success check
A pause press (Escape, or Start on any pad in the match) freezes the sim and round timer and shows a menu (Resume, Music on/off, Sounds on/off, Music and Sounds volume, Main menu) that any player in the match drives; Resume / pause / back continues the same round with no catch-up burst and no jump or shot from the press that resumed.

## In scope
- Pure pause-menu reducer (rows, shared cursor, open / close, effects) with unit tests.
- Session: per-slot `PlayerInput.pause` edge opens / closes; while open no `stepGame`, no `sound.hear`, no restart / lobby-back checks; menu presses only from devices playing this match; on resume the fixed-step clock restarts and jump / fire held at resume are ignored until released.
- DOM overlay over the canvas (theme tokens, like the lobby menu), pointer works too; controls hint names the pause key.
- Sound rows write the app audio engine's settings (`withChannelEnabled`, `withVolumeStep`) — same settings the lobby shows.

## Out of scope
- Will NOT do: match settings in the pause menu (owner: lobby-only); pause on tab blur.
- Will NOT touch: lobby menu, sim systems, terrain / arena / combat (parallel terrain chain).

## Edges
| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| pause (new feature) | Not found | `src/features/pause/` (reducer, `createPausableInput`, `usePauseMenu`, overlay) | new — match services were at their 10-file budget, and the pause menu is its own bounded concept |
| match (session, GameView) | ticker frame → input → steps → sound → render | `useGameSession` frame + `GameView` overlay | ride — composition root |
| sound (settings) | lobby rows → `engine.updateSettings` | `soundApi` (`withChannelEnabled`, `withVolumeStep`, `isChannelEnabled`) | ride — export `isChannelEnabled` |
| shared input | `PlayerInput.pause`, `MenuInput` per device | `inputSourceKey`, `INPUT_DEVICES` | ride — no change |

## Size
S — new `pause` feature wired into match, plus one sound export; no new dependency.Cut into laps: none

## Decisions
- D1 Any player in the match drives the open menu (one shared cursor, like the lobby); any player's pause press, back, or Resume closes it.
- D2 Paused = no sim steps, no round-timer, no sound cues, no restart/lobby checks; the fixed-step clock restarts on resume (no catch-up). Music pauses with the game and resumes in sync (owner choice after Stop 2 review; supersedes "music keeps playing").
- D3 Main menu = the lobby (players, level, settings kept), same as the round-end back press.
- D4 "General options" = the Music and Sounds volumes (player preferences already shared with the lobby); nothing else until a real option exists.
- D5 Pause also opens on the round-result screen (one rule everywhere); the restart lock waits while paused.
- D6 Opening press is consumed for the menu (pad Start is also menu confirm); jump / fire held when the menu closes are masked per slot until released.
