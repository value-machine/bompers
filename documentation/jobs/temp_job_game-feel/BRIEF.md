# Brief: Game feel — hit flash, screen shake, helmet wobble (lap `game-feel`)

**Problem.** The visual pass (style E) shipped without the hit feedback DESIGN_LANGUAGE § 6 asks for: no hit flash, no screen shake, no helmet spring. Hits read weakly; the owner loves funny, physical reactions to hits.

**Success check.** On the PR preview: a hit flashes the victim's body white for a moment with the outline unchanged (back hits stronger); hits, explosions and tumble bounces shake the screen briefly, and several at once shake harder but never wildly; the helmet and emblem wobble after landings, jumps, hits and tumble bounces; a back hit freezes the picture for about 3 frames. With the OS "reduce motion" setting there is no shake and the flash is softer. No gameplay change.

**Scope.** Tunables section `feel`; `camera/services/cameraShake.ts`; `effects/services/feelCues.ts`; helmet split + spring + flash overlay in `player`; wiring in `match/services/gameRenderer.ts`; `shared/utils/dampedSpring.ts`, `reducedMotion.ts`.

**Edges.** Render only: no sim state written. No lobby toggle (the lobby has no motion settings row; the OS media query is the switch). No HUD chunk squash (left out; cheap follow-up). Idle breathing under reduced motion unchanged. `src/config/app-tasks.json` untouched.

**Size.** M (five feature areas touched, pure parts unit-tested).

## Decisions

- D1 Feel is render-only and wall-clock based, like the blob squash; the sim stays deterministic.
- D2 Shake is a screen-px offset applied with the camera view, never part of `CameraView` (framing and outline clamp unaffected). Kicks sum as a root of squares, capped.
- D3 Event reading lives in `effects` (event-driven feedback); `camera` owns only shake math, `player` only how flash and wobble are drawn. Players are read through a structural slice, so effects does not import `player`.
- D4 Hit-stop starts on the frame after the hit, so the hit frame (with its flash) is what holds; HUD and sim keep running.
- D5 The helmet is split from the body into its own ink + fill layers (dome under the eyes, gloss + emblem over them) so it can move without breaking the silhouette line.

## Verified

Unit tests (spring, shake decay / sum / cap / pool, flash timing, cue reading, helmet kicks and caps); type-check, lint (no new warnings), arch, structure, feature size. Headless Chromium video of a 2-player match: the hit victim shows the white flash with intact outline and the helmet tilts. Not verified by eye: shake amplitude feel and 60 fps on a real device.
