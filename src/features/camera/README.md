# camera

## Purpose

Multi-target camera (GDD § 2): pure math that turns the active players' feet points, arena bounds and the viewport size into a view (`centerX`, `centerY`, `zoom`) every rendered frame, and applies that view to the world render container. Renderers read the current zoom from `GameRenderer.camera.zoom` (e.g. the outline zoom rule in `documentation/game/DESIGN_LANGUAGE.md` § 3).

## Structure

| Layer | Path | Purpose |
|-------|------|---------|
| Types | `types/camera.types.ts` | `CameraView`, `Viewport`, `CameraSettings`, `CameraFrameArgs` (`targets`, `bounds`, `viewport`, `previous`, `padding`, `dt`, optional `settings`) |
| Services | `services/cameraView.ts` | `computeCameraView(args)` — goal view → deadzone → zoom limits → bounds clamp → damping → hard containment; `applyCameraView(world, view, viewport)` |
| API | `api/cameraApi.ts` | Public seam |

Pipeline per frame (`computeCameraView`):
1. **Goal:** frame the targets' bounding box + `padding`. 0 targets → arena centre at arena-fit zoom. First frame (`previous` null) snaps to the goal.
2. **Deadzone:** the centre pans only by how far the framed centre left a central box (`deadzone` × visible view) around the current centre; zoom-in smaller than `zoomInDeadband` is ignored.
3. **Zoom limits:** max zoom-in = `viewport.height / minViewHeight` (also the single-player view); max zoom-out = the arena + `padding` fits the viewport. Viewport-independent framing.
4. **Bounds clamp:** the visible area stays inside the level on each axis where it is smaller than the level.
5. **Damping:** exponential, dt-based (`1 - e^(-rate·dt)`); zoom eases in log space; `zoomOutRate` > `zoomInRate`.
6. **Hard containment:** after damping, zoom out just enough that every target keeps `edgeMargin` from the screen edge. The bounds clamp beats `padding`; `edgeMargin` beats the clamp and the zoom-out limit.

Tunables: the `camera` section of `src/shared/config/gameTunables.ts`. `match/services/gameRenderer.ts` passes only `padding`; the rest defaults to `DEFAULT_GAME_TUNABLES.camera`. Seam: pass `settings: state.tunables.camera` there to make the camera per-match tunable.

## Dependencies

- `pixi.js` (type `Container` only), `src/shared/types/gameGeometry.types.ts`. Imports no other game feature.
- Consumed by `match` (`gameRenderer.ts`).

## Decisions

- The camera runs per rendered frame, outside the fixed-step simulation: it is presentation and depends on the viewport size (game-engine-foundation).
- Zoom limits are in world units (min visible height, arena fit), not raw zoom factors, so the framing is the same on every screen size (multi-target-camera).
- Keeping every player on screen beats the zoom-out limit and the level-bounds clamp; out-of-bounds kills bound how far it zooms out (multi-target-camera).
- `settings` is optional on `CameraFrameArgs` so the renderer's call stays unchanged (multi-target-camera).
