# Brief — Controller focus highlight in menus

Task: Controller focus highlight in menus · Lap: temp_job_controller-focus · Branch: `claude/controller-focus` off `c76afaa`

## Problem
Menus show the cursor row the same way for every input; the owner wants a clear highlight on the active element only when players drive the menu with a pad, and none for PC pointer use (`:focus-visible` behaviour).

## Success check
After a pad press the element under the shared cursor (lobby row, weapons crate cursor, level strip row, pause row/button) carries the chosen highlight; after a mouse move or click no element carries it, and the next pad press shows it again at the unchanged cursor.

## In scope
- Shared input-modality detection (last input: pad | keyboard | pointer) — `src/shared/` hook/store, read by both menus. Can be built before #70/#71 merge.
- The picked highlight look applied to lobby rows, crate cursor, level strip (after #70), pause rows/buttons.
- Owner options page step 6: https://claude.ai/artifact/3wJETURFQ3QVVzuJ6U2WHx (looks A ring · B lift · C pulse; rec. A).

## Out of scope
- Will NOT do: pointer hover moving the shared cursor; new menu rows; DOM focus management.
- Will NOT touch: `reduceLobby` / `reducePauseMenu` cursor logic, in-match input, `src/config/app-tasks.json`.
- Lobby code untouched until the orchestrator says PR #70 and #71 merged.

## Edges
| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| shared input (`gameInputService`, `useLobbyInput`) | rAF `sampleMenus` → presses per device | modality signal from menu presses (pad device vs key device) + window pointer events | new — shared modality store |
| lobby (`LobbyMenu` Row, WeaponToggles; #70 strip) | `focused` → `border-ring bg-accent`; crate `ring-2` | class gated by modality | ride |
| pause (`PauseMenu` Row) | `focused` → `border-ring bg-accent` (second copy of lobby Row) | same | ride |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size
S — one shared store/hook + class changes in two menu components. The shared highlight class is the natural seed of the menu-row primitive the pause README marks (F2, second copy); extraction stays out unless a third menu appears.
Cut into laps: none

## Decisions
DECISIONS.md D1–D3. Open: D1 look (owner pick on the options page), D2 keyboard counts as pad or as PC (conflict: owner note "PC doesn't" vs keyboard-half players who navigate with keys).
