# Brief — Lobby and match settings + Level picker

Tasks: "Lobby and match settings", "Level picker" · Lap: temp_job_lobby · Base: `main`

## Problem

`/` drops straight into a match: every connected keyboard half and pads 0–1 join automatically, there is no way to choose a level other than by importing a file, no match settings, and after the round only "jump to restart" exists (GDD § 1 player counts, § 7 configurable settings).

## Success check

Unit tests: slot claiming / leaving (first free slot, no double claim, full lobby, empty slots stay disconnected), settings precedence (lobby duration vs a level's `matchDurationS`, gravity multiplies), the reducer (join, menu, start only with ≥ 1 player and a playable level), the built-in manifest matching `public/levels/`, the level library (titles + authors, imports added, rejects reported). Headless Chromium: two keyboard players join, change duration and level, one leaves and rejoins, start, round ends, rematch, back to the lobby with players and settings kept.

## In scope

- New `features/lobby`: slots, menu reducer, settings, view model, `useLobby` (state that outlives the screen), `useLobbyInput` (per-frame device polling), join screen components.
- `level-file`: `useLevelSource` → `useLevelLibrary` (built-in manifest + session imports), picker handle on `LevelImportControl`.
- `match`: `useGameSession(app, setup, onExitToLobby)`, `GameView` takes a `MatchSetup`, banner hint "Jump: rematch · Back: lobby".
- Shared: menu mapping (`MenuInput`, `INPUT_DEVICES`, one back key per device), nullable slot sources, autorepeat ignored, emblem geometry extracted (third copy), `toCssColor`.
- `pages/GamePage.tsx`: lobby ⇄ match flow.

## Out of scope

- Will NOT do: app name / icons / top bar (PR #18), real-pad verification (later task), per-player ready handshake, rebinding keys.
- Will NOT touch: `app-tasks.json`, protected files.

## Size

M. Cut into laps: none.
