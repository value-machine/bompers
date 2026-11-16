# lobby

## Purpose

The join screen before a round (GDD § 1, § 7): 1–4 players claim a slot from any input device (left keyboard half, right keyboard half, gamepads 0–3), see their blob in its colour and helmet emblem, leave again, and drive one shared menu — level (built-in or imported), "Your level" (load a file), match length, gravity, start, then Music and Sounds volumes. The lobby plays the lobby music. One player = test mode. The lobby state outlives the screen, so after a round "back" returns with the same players, level and settings.

## Structure

| Layer      | Path                            | Purpose                                                                                                                                                       |
| ---------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types      | `types/lobby.types.ts`          | `LobbyState` (slots, cursor, level id, `MatchSettings`), `LobbyAction`, `LobbyEffect` (`start` / `pickFile`), `LobbyContext`, view types                      |
| Services   | `services/lobbySlots.ts`        | `claimSlot` (first free slot), `leaveSlot`, `slotSources` (null = empty slot for the match), device labels and join / leave keys                              |
| Services   | `services/matchSettings.ts`     | Duration / gravity options, `applyMatchSettings` (lobby → tunables), `effectiveSettings` (what a level will really use, through match's `applyLevelSettings`) |
| Services   | `services/lobbyMenu.ts`         | `LOBBY_ROWS`, `reduceLobby(state, action, context)` → `{ state, effect }` — the one state machine for keys, pads and pointer; `canStart`, `selectedLevelId`   |
| Services   | `services/lobbyView.ts`         | `lobbyView` — display values for the screen (components hold no rules)                                                                                        |
| Hooks      | `hooks/useLobby.ts`             | Lobby state (kept by the page across rounds), `dispatch`, `matchSetup()` → `MatchSetup` for `GameView`                                                        |
| Hooks      | `hooks/useLobbyInput.ts`        | Polls every device's `MenuInput` once per animation frame, turns new presses into `press` actions, reports per-device activity for the indicators             |
| Components | `components/LobbyScreen.tsx`    | Composes slots, menu, device strip; carries out effects (start, open file picker); level-file drop                                                            |
| Components | `components/PlayerSlotCard.tsx` | One slot: blob, `P1 ●`, device + live input indicator, leave key; or the join prompt. `InputIndicator`                                                        |
| Components | `components/LobbyMenu.tsx`      | The rows; the cursor row is highlighted; steppers and buttons for the pointer                                                                                 |
| Components | `components/BlobBadge.tsx`      | SVG blob of a slot (colour, shade feet, helmet emblem from `shared/utils/playerEmblem`)                                                                       |
| API        | `api/lobbyApi.ts`               | `useLobby`, `LobbyScreen` (mounted by `pages/GamePage.tsx`)                                                                                                   |

Controls: join / confirm Space or F (left keys), Enter or / (right keys), A or Start (pad); back Q, Backspace, B; directions W A S D, arrows, d-pad or left stick. A pad shows up after its first button press (browser rule); "Pad N" is the browser's gamepad index, so a replugged pad may come back as another number. In-match pad controls: `ARCHITECTURE.md` input row.

## Dependencies

- `sound` (`useAudioEngine`, `useSoundSettings`, `useMusicTrack`, `withVolumeStep`) through its api; volume effects are applied in `useLobby`.
- `level-file` (`useLevelLibrary` entries, `LevelImportControl` + picker handle), `level` (types), `match` (`MatchSetup`, `applyLevelSettings`) through their `api/` files.
- Shared: `gameInputService` (`sampleMenus`), `gameInputMapping` (`INPUT_DEVICES`, `inputSourceKey`), `gameTunables`, `gamePalette`, `playerEmblem`, `useFileDrop`; kit `Button`.
- Mounted by `src/pages/GamePage.tsx`, which switches between `LobbyScreen` and `match`'s `GameView`.

## Decisions

Lap record: `documentation/jobs/temp_job_lobby/DECISIONS.md`.

- Settings precedence: gravity multiplies (engine × lobby × level); a level's `matchDurationS` wins over the lobby's duration, and the menu says so (lobby D2).
- The players' own controls drive one shared menu; a device without a slot can only join (lobby D3).
- Slots are fixed: leaving frees only that slot, a new joiner takes the first free one (lobby D4).
- Round end: jump = rematch, back = lobby with players and settings kept (lobby D5).
- Volume rows sit below Start and emit a `volume` effect; the volumes live in the sound feature, not in `LobbyState` (music D3).
