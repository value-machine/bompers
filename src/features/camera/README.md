# camera

## Purpose

Framing: pure math that turns targets, arena bounds and the viewport size into a view (`centerX`, `centerY`, `zoom`), and applying that view to the world render container. Owner of follow-up work: the multi-target-camera lap (zoom limits, smoothing, central deadzone; GDD § 2).

## Structure

| Layer    | Path                     | Purpose                                                                                                    |
| -------- | ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Types    | `types/camera.types.ts`  | `CameraView`, `Viewport`, `CameraFrameArgs` (`targets`, `bounds`, `viewport`, `previous`, `padding`, `dt`) |
| Services | `services/cameraView.ts` | `computeCameraView(args)` — placeholder fits the arena bounds; `applyCameraView(world, view, viewport)`    |
| API      | `api/cameraApi.ts`       | Public seam                                                                                                |

Seams for later work:

- **Camera lap:** replace the body of `computeCameraView`; `targets` (active player feet points), `previous` (last frame's view, for smoothing) and `dt` are already passed in every frame by `match/services/gameRenderer.ts`. Tunables go in the `camera` section of `src/shared/config/gameTunables.ts`.

## Dependencies

- `pixi.js` (type `Container` only), `src/shared/types/gameGeometry.types.ts`. Imports no other game feature.
- Consumed by `match` (`gameRenderer.ts`).

## Decisions

- The camera runs per rendered frame, outside the fixed-step simulation: it is presentation and depends on the viewport size (game-engine-foundation).
