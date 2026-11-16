# Brief — Gamepad support and verification

Task: Gamepad support and verification · Lap: temp_job_gamepad-support · Harness: v0.45.0

## Problem
Gamepad play exists in code (pads 0–3 join in the lobby, standard mapping → `PlayerInput`) but was never verified with real controllers, and the stick handling has rough edges: a per-axis (square) deadzone that jumps from 0 to 0.25 speed and snaps diagonal aim near the axes, no guard for pads the browser reports as disconnected, and no per-player pause press for the queued pause-menu lap.

## Success check
`mapGamepadInput` turns a stick just past the deadzone into a small run speed (not a 0.25 jump), aims the rocket in the stick's true direction (radial deadzone), reports a pad with `connected === false` as disconnected, and every slot's `PlayerInput.pause` is true while that player's Start (pad button 9) or Escape (keyboard halves) is held — proven by unit tests; the owner then plays with up to 4 real pads at Stop 2.

## In scope
- Left stick horizontal move: axial deadzone on x with rescale to 0…1 (no jump at the edge; straight-up stick does not creep sideways).
- Aim (right stick, fallback left stick): radial deadzone on the 2D stick, clamped to the unit circle.
- `PlayerInput.pause` (held; edge derived by the consumer like `jump`): pad Start, keyboard Escape on both halves. Not consumed by the sim (pause menu is a later lap).
- Gamepad snapshot ignores pads whose `connected` is false (polling `getGamepads()` each frame already covers hot-plug; no event listeners needed).
- Hot-plug and disconnect behaviour verified by test: pad index absent mid-match → slot input empty (player idles, stays in the round); reappears → input resumes.
- Docs: ARCHITECTURE.md input row, lobby README controls line (pad buttons), owner test steps.

## Out of scope
- Will NOT do: pause menu UI or pausing the sim — later lap. Button remapping, rumble, non-standard (`mapping !== "standard"`) pad layouts, more than 4 pads, on-screen "controller disconnected" UI — deferred.
- Will NOT touch: keyboard bindings (except adding Escape as pause), lobby state machine, sim / combat / dive rules, match flow.

## Edges
| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| shared input (`types/gameInput.types.ts`, `utils/gameInputMapping.ts`, `services/gameInputService.ts` + tests) | keys + `navigator.getGamepads()` → `mapPlayerInputs` / `mapMenuInputs` each frame | `mapGamepadInput` deadzones, `toSnapshot`/`readGamepads`, new `pause` field | ride |
| docs (`ARCHITECTURE.md`, `src/features/lobby/README.md` controls line) | lists `PlayerInput` fields and lobby controls | text only | ride |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size
S — one shared module family plus tests and two doc lines; no feature code changes.
Cut into laps: none

## Decisions
DECISIONS.md D1–D4 (all clear-winner; no recorded-decision conflict).

## Plan (S)
1. Acceptance tests first (`gameInputMapping.test.ts` deadzone ramp, no sideways creep, true aim direction, unit-circle clamp, pause; `gameInputService.test.ts` unplug / replug with a stubbed `navigator.getGamepads`).
2. `pause` on `PlayerInput` + keyboard layouts + pad Start; `pastDeadzone` / `axisPastDeadzone` / `stickPastDeadzone` replace the per-axis `applyDeadzone`; `toSnapshot` drops `connected: false` pads.
3. Fold D1–D4 into the `ARCHITECTURE.md` input row and the lobby README controls line.

## Check summary
- Gates: `pnpm test:run` 46 files / 387 tests pass; `pnpm type-check`, `pnpm arch:check`, `pnpm validate:structure` pass; lint 0 errors (no new warnings in touched files).
- Test-authority note: the old "aim with the right stick" test expected raw 0.8 move; D1 replaces the square deadzone, so its expected value now derives from `GAMEPAD_DEADZONE`.
- Not verified: real controllers (no pad in the cloud container; owner at Stop 2), browsers' non-standard mappings, Escape now has `preventDefault` (game keys only; browser fullscreen exit is not blockable).
