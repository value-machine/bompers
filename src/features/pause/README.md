# pause

## Purpose

The in-match pause menu (FEEDBACK_ROUND_2 § 2.2): any player in the match presses pause (Escape, or Start on their pad) and the match freezes behind a menu of player preferences — Resume, Music on/off, Sounds on/off, Music and Sounds volume, Main menu (the lobby). Match settings stay in the lobby. The match session asks this feature whether it is paused and forwards its players' presses; this feature never touches the sim.

## Structure

| Layer      | Path                       | Purpose                                                                                                                                                                                                                                 |
| ---------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types      | `types/pause.types.ts`     | `PauseRow`, `PauseMenuState { open, cursor }`, `PauseButton` (menu buttons + `pause`), `PauseAction` (press / pointer activate / pointer cycle)                                                                                          |
| Services   | `services/pauseMenu.ts`    | `PAUSE_ROWS`, `reducePauseMenu(state, action)` → `{ state, effect }` (resume, mainMenu, toggle channel, volume step) — pure; `pausePressesOf(menus, previous, playing)` (new menu presses of the match's devices); `heldGateOf` / `gateHeldInputs` (jump / fire held at resume hidden until released) |
| Services   | `services/pausableInput.ts` | `createPausableInput(reader, { pause, sources })` → per frame `{ inputs, back, resumed }` or null while the match holds: pause edges per slot, menu presses of the match's devices to the link, held-input gate after resume |
| Hooks      | `hooks/usePauseMenu.ts`    | `usePauseMenu(onMainMenu)` → `{ menu, focusedRow, sound, link, dispatch }`; a ref holds the state so the session's `link.isOpen()` sees a change in the same frame; sound effects write the app audio engine (`withChannelEnabled`, `withVolumeStep`) |
| Components | `components/PauseMenu.tsx` | The overlay over the canvas (theme tokens, like the lobby menu); highlighted row = shared cursor; every row works with the pointer                                                                                                       |
| API        | `api/pauseApi.ts`          | Public seam for the match (`usePauseMenu`, `PauseMenu`, `PauseLink`, `createPausableInput`)                                                                                                                                             |

## Dependencies

- `sound` through `api/soundApi.ts` (settings helpers, engine, `useSoundSettings`).
- Shared: `gameInput.types` (`MenuInput`, `PlayerInput`), `components/common/Button`, `cn`.
- Mounted by `match` (`GameView` renders the overlay; `useGameSession` reads its frames through `createPausableInput`).

## Decisions

- D1 Any player in the match drives the open menu with one shared cursor (like the lobby); any player's pause press, back, or Resume closes it. Devices not in the match are ignored.
- D2 Paused = no sim steps, no round timer, no sound cues, no rematch / lobby checks; the fixed-step clock restarts on resume (no catch-up burst). Music keeps playing; the menu has its own music switch.
- D3 Main menu = the lobby with players, level and settings kept (same as the round-end back press).
- D4 "General options" = the Music and Sounds volumes, the player preferences the lobby also shows; nothing else until a real option exists.
- D5 Pause opens on the round-result screen too (one rule everywhere); the restart lock waits while paused.
- D6 The opening press is consumed (pad Start is also menu confirm), the closing frame does nothing else, and jump / fire held when the menu closes are hidden from the sim per slot until released (Space confirms Resume and would jump).
- The menu-row look is a second copy of the lobby's `Row` / `Stepper` (marked in `PauseMenu.tsx`); a third such menu extracts a shared menu-row primitive.
