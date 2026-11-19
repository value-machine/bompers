# lobby

## Purpose

The join screen before a round (GDD § 1, § 7): 1–4 players claim a slot from any input device (left keyboard half, right keyboard half, gamepads 0–3), see their blob in its colour and helmet emblem, leave again, and drive one shared menu — level (built-in or imported), "Your level" (load a file), match length, weapons, gravity, start, then Music and Sounds volumes. The lobby plays the lobby music. One player = test mode. The lobby state outlives the screen, so after a round "back" returns with the same players, level and settings.

## Structure

| Layer      | Path                            | Purpose                                                                                                                                                       |
| ---------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types      | `types/lobby.types.ts`          | `LobbyState` (slots, cursor, level id, `MatchSettings`), `LobbyAction`, `LobbyEffect` (`start` / `pickFile`), `LobbyContext`, view types                      |
| Services   | `services/lobbySlots.ts`        | `claimSlot` (first free slot), `leaveSlot`, `slotSources` (null = empty slot for the match), device labels and join / leave keys                              |
| Services   | `services/matchSettings.ts`     | Duration / gravity options, weapons (`weaponsOff`, `lobbyWeaponIds`, `toggleWeapon`), `applyMatchSettings` (lobby → tunables), `effectiveSettings` (what a level will really use, through match's `applyLevelSettings`) |
| Services   | `services/lobbyMenu.ts`         | `LOBBY_ROWS`, `reduceLobby(state, action, context)` → `{ state, effect }` — the one state machine for keys, pads and pointer; `canStart`, `selectedLevelId`   |
| Services   | `services/lobbyView.ts`         | `lobbyView` — display values for the screen (components hold no rules)                                                                                        |
| Hooks      | `hooks/useLobby.ts`             | Lobby state (kept by the page across rounds), `dispatch`, `matchSetup()` → `MatchSetup` for `GameView`                                                        |
| Hooks      | `hooks/useLobbyInput.ts`        | Polls every device's `MenuInput` once per animation frame, turns new presses into `press` actions, reports per-device activity for the indicators             |
| Components | `components/LobbyScreen.tsx`    | Composes slots, menu, device strip; carries out effects (start, open file picker); level-file drop                                                            |
| Components | `components/PlayerSlotCard.tsx` | One slot: blob, `P1 ●`, device + live input indicator, leave key; or the join prompt. `InputIndicator`                                                        |
| Components | `components/LobbyMenu.tsx`      | The rows; the cursor row (and the crate cursor) carries the menu focus mark after key / pad input; steppers and buttons for the pointer                       |
| Components | `components/LevelStrip.tsx`       | The \"Level\" row: a strip of thumbnail cards (`LevelThumbnail`), built-ins then imports, then a \"Load level\" card; the picked card lifts and scrolls into view; imported cards carry the memory chip (Saved copy / Linked / Updated / Relink / File missing) |
| Components | `components/RememberedLevelActions.tsx` | In the \"Your level\" row for a picked import: Relink file / Find file… / Forget plus a one-line state note |
| Components | `components/BlobBadge.tsx`      | SVG blob of a slot (colour, shade feet, helmet emblem from `shared/utils/playerEmblem`)                                                                       |
| Components | `components/WeaponCrateIcon.tsx` | SVG of a weapon's in-game crate (accent box, ink mouth mark in a white outline, gloss; proportions from `shared/utils/weaponCrate`), used as the weapons toggles |
| API        | `api/lobbyApi.ts`               | `useLobby`, `LobbyScreen` (mounted by `pages/GamePage.tsx`)                                                                                                   |

Controls: join / confirm Space or F (left keys), Enter or / (right keys), A or Start (pad); back Q, Backspace, B; directions W A S D, arrows, d-pad or left stick. A pad shows up after its first button press (browser rule); "Pad N" is the browser's gamepad index, so a replugged pad may come back as another number. In-match pad controls: `ARCHITECTURE.md` input row.

## Dependencies

- `sound` (`useAudioEngine`, `useSoundSettings`, `useMusicTrack`, `withVolumeStep`) through its api; volume effects are applied in `useLobby`.
- `level-file` (`useLevelLibrary` entries, `forget` / `relink`, `LevelImportControl` + picker handle), `level-memory` (`droppedFileHandle`, so dropped files link too), `level` (`LevelThumbnail`), `level-kit` (`CopyLevelPromptButton`, in the "Your level" row; mouse/touch only, the row's controller action stays "open the file picker"), `level` (types), `match` (`MatchSetup`, `applyLevelSettings`) through their `api/` files.
- Shared: `gameInputService` (`sampleMenus`), `gameInputMapping` (`INPUT_DEVICES`, `inputSourceKey`), `gameTunables`, `gamePalette`, `playerEmblem`, `useFileDrop`; kit `Button`.
- Mounted by `src/pages/GamePage.tsx`, which switches between `LobbyScreen` and `match`'s `GameView`.

## Decisions

Lap record: `documentation/jobs/temp_job_lobby/DECISIONS.md`.

- Focus mark (owner, controller-focus D1–D2): the cursor row gets an ink ring with the sky wash (`menu-focus-row`), the crate under the crate cursor an ink ring with a gap (`menu-focus`), only while the last menu input was a key or pad press; pointer use hides them and the cursor keeps its place (`shared/services/menuFocusModality`, fed by `useLobbyInput`). The level strip's picked card keeps its own lift; in the Level row the ring is on the row, not the card.
- Settings precedence: gravity multiplies (engine × lobby × level); a level's `matchDurationS` wins over the lobby's duration, and the menu says so (lobby D2).
- Weapons row (owner, weapons-match-setting D5–D7; level-direction D6): one toggle per weapon, drawn as its in-game crate; on = the crate as it falls, off = greyed and faded. Any combination; all on = auto (stored as the off set, so a new weapon starts on), all off = no weapon crates. Pads: the row has its own crate cursor (left / right, wrapping), confirm toggles; the pointer clicks a crate. A level with `data-weapons` shows its weapons on the crates, locked, with "Set by the level".
- The players' own controls drive one shared menu; a device without a slot can only join (lobby D3).
- Slots are fixed: leaving frees only that slot, a new joiner takes the first free one (lobby D4).
- Round end: jump = rematch, back = lobby with players and settings kept (lobby D5).
- Volume rows sit below Start and emit a `volume` effect; the volumes live in the sound feature, not in `LobbyState` (music D3).
- Level row = thumbnail strip (owner pick, variant 1, 2026-11-18; options page round 2): built-in and imported levels share it; left / right still cycle the pick through the reducer, a card click selects. The strip's "Load level" card replaces the separate button; the "Your level" row keeps the controller action (open the picker), the import report, Relink / Forget and the prompt button. Relink / Forget are pointer buttons (Relink needs a click for the browser's permission prompt).
- Strip overflow: only the strip scrolls sideways; `contain-inline-size` keeps the cards from sizing the strip, so a long library never widens the lobby (owner report, 2026-11-19).
