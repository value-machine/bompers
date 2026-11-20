# Brief — gamepad-audio-unlock

Source: backlog "Unlock audio on gamepad input". Size: **XS–S**.

## Problem

The AudioContext resumes only on keydown or pointerdown. A player who only uses a gamepad hears nothing: no browser counts a gamepad button as user activation (HTML activation-triggering events are keyboard, mouse, pointer and touch only; w3c/gamepad#4 is still open, Chromium only trials gamepad button events). A gamepad press can still resume audio where the browser allows it anyway: the page already has sticky activation, Chrome's media-engagement autoplay allowance, or a Firefox/Safari per-site autoplay setting.

## Success check

- The first gamepad button press calls `resume()`; where the browser allows it, sound starts with no other input.
- Where it stays suspended, a small "Tap for sound" chip shows top-right (owner pick B, D1) until a key or tap starts the sound, then it disappears.
- No chip before any gamepad press, and never while sound runs.
- No gamepad polling while sound runs.

## In scope

- `sound` service that watches gamepads while the context is suspended, resumes on a press, and reports "needs a gesture".
- Reusable `SoundStatusChip` (role name; the mute-indicator lap may reuse it) plus the hint that mounts it on the game page.

## Out of scope

- Mute indicator (its own lap), any change to key / pointer unlock, Gamepad API activation itself.

## Edges

| Area                 | Change                                                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/sound`     | `services/gamepadAudioUnlock.ts` (+ test), engine status, `components/SoundStatusChip.tsx`, `components/SoundStatusCorner.tsx` (+ test), `music` split (refactor commit), hook, api, README |
| `pages/GamePage.tsx` | mounts the hint                                                                                                                                                                             |

## Plan (XS)

1. Acceptance test: `gamepadAudioUnlock` — press resumes; still suspended after the grace → needs a gesture; running clears it and stops polling.
2. Service + engine wiring (`needsGesture`, `subscribeStatus`), hook `useSoundStatus`.
3. Chip with a `status` prop (look B) + one placement wrapper (`top-right` lobby, `bottom-right` match, clear of the HUD cards), mount on `GamePage`; component test.
4. README, type-check, targeted tests.

Reuse: no package covers this (a few lines over `navigator.getGamepads`). Precedent: games and engines (Unity WebGL, Phaser, Construct) show a "click / tap to enable sound" prompt when the context is locked; ours shows only after a pad press, the case they miss.
