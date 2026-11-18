# backdrop

## Purpose

The picture behind the arena: sky, sun, far hills and clouds, near hills, drawn in screen space with parallax. It knows nothing about the terrain grid or the game state beyond the camera and the world's height.

## Structure

| Layer    | Path                           | Purpose                                                                                                                                                                                                                                                                 |
| -------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Services | `services/backdropRenderer.ts` | Screen-space sky, sun, far hills + clouds (parallax 0.2), near hills (0.4), baked once into textures (tiling hill bands with opaque fills below; each layer stops where the one in front is opaque, so no overdraw); `createBackdropView(renderer)`, `syncBackdropView` |
| API      | `api/backdropApi.ts`           | Public seam                                                                                                                                                                                                                                                             |

## Dependencies

- `pixi.js`, `src/shared/config/gamePalette.ts`. No game feature.
- Consumed by `match` (`gameRenderer`: the first layer on the stage, under the world).

## Decisions

- Its own feature since 2026-11-18 (mover-materials lap 4 preparation): it lived in `arena`, whose one domain is the terrain runtime. The move frees a file in `arena/services` (budget 10) for the lap that puts craters on moving parts. Code and look are unchanged.
