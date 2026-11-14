# Brief — Multi-target camera

Task: Multi-target camera · Lap: temp_job_multi-target-camera · Harness: v0.44.0 · Base: `claude/game-engine-foundation` (PR #5)

## Problem
Players on a shared screen need a camera that keeps every active blob in view and framed as tightly as the fight allows (GDD § 2), instead of the placeholder that always shows the whole arena.

## Success check
For two players moving apart from the arena centre at 60 fps, every rendered frame shows both feet points on screen, the view zooms out smoothly, never zooms out further than needed (arena fit) while they stay inside the arena, and a sub-deadzone move leaves the view unchanged.

## In scope
- `computeCameraView` body: frame all targets with padding; central deadzone (centre) + zoom-in deadband; zoom between max zoom-in (min visible world height) and max zoom-out (fit arena + padding); exponential dt-based damping in log-zoom and position, zoom-out faster than zoom-in; clamp to level bounds where the view is smaller than the arena; per-frame hard containment so smoothing lag never drops a target off screen (containment beats both the zoom-out limit and the bounds clamp).
- 0 targets: ease to the arena-fit view at the level centre. 1 target: max zoom-in limit (comfortable single-player view). First frame (`previous` null): snap.
- `camera` tunables section + type.
- Unit tests (TDD); README update.

## Out of scope
- Will NOT do: outline-width-by-zoom (renderers read `CameraView.zoom`, already on `GameRenderer.camera`; the visual-pass lap applies DESIGN_LANGUAGE § 3 zoom rule) — excluded.
- Will NOT do: off-screen indicators / screen shake — deferred.
- Will NOT touch: `gameRenderer.ts`, `applyCameraView`, `CameraFrameArgs` signature.

## Edges
| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| camera | `gameRenderer.renderFrame` → `computeCameraView` (fit arena) → `applyCameraView` | `services/cameraView.ts` body | ride — seam built for this lap |
| shared/config tunables | `DEFAULT_GAME_TUNABLES.camera.padding` | `camera` section + `GameTunables.camera` type | ride |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size
S — one service body, one tunables section, tests. No cleanup beyond replacing the placeholder.
Cut into laps: none

## Plan (S)
1. Acceptance test first (`cameraView.test.ts`): two targets diverging over 3 s at 60 fps → every frame contains both feet points; zoom within limits after convergence.
2. Tunables: `padding`, `minViewHeight` (max zoom-in), `deadzone` (fraction of view, centre), `zoomInDeadband`, `followRate`, `zoomInRate`, `zoomOutRate`, `edgeMargin` (hard containment margin).
3. Implement as small pure helpers in `cameraView.ts` (target view → deadzone → zoom limits → bounds clamp → damping → hard containment); keep complexity under ESLint limits.
4. Tests: deadzone holds, zoom clamped, 0/1 targets, far apart beyond arena, dt-independence (60 vs 120 Hz), zoom-out faster than zoom-in, degenerate viewport.
5. Gates: type-check, lint, test, arch, structure; headless Chromium run with two players moving apart (scratch script, not committed).

## Decisions
- D1 Zoom limits are viewport-independent: max zoom-in = `viewport.height / minViewHeight`; max zoom-out = arena fit. Keeps the framing identical across screen sizes (precedent: Smash/TowerFall-style shared cameras frame in world units).
- D2 Containment wins over limits: the bounds clamp beats `padding`, but the hard `edgeMargin` beats both the clamp and the max zoom-out, so targets past the arena edge stay in view (owner task text: "keep everyone in view rather than clamping them out"). Out-of-bounds kills bound how far this goes.
- D3 Damping in log-zoom space so zoom feels the same at any scale.
