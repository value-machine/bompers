# backdrop

## Purpose

The picture behind the arena, drawn from the level's theme: sky, sun or moon, an optional hanging ceiling, far band and clouds, near band, ambient particles, all in screen space with parallax. It knows nothing about the terrain grid or the game state beyond the camera, the world's height and the theme ID the level names.

## Structure

| Layer    | Path                           | Purpose                                                                                                                                                                                                   |
| -------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Services | `services/backdropRenderer.ts` | `createBackdropView(renderer, theme)`, `syncBackdropView`: every layer baked once into textures (tiling bands with opaque fills below; each layer stops where the one in front is opaque, so no overdraw) |
| Services | `services/backdropBands.ts`    | One period of a band (`hills`, `peaks`, `spires`, `rocks`, `kelp`, `skyline`, `roofs`) and of a ceiling, as Graphics to bake; seeded so a theme always looks the same                                     |
| Services | `services/backdropAmbient.ts`  | Stars, snow, embers, bubbles: one baked dot, at most 48 sprites; `ambientPose` is a pure function of time and camera                                                                                      |
| API      | `api/backdropApi.ts`           | Renderer seam (loads Pixi)                                                                                                                                                                                |

The themes themselves (registry, recipes, types) live in `backdrop-themes`.

## Dependencies

- `pixi.js`, `src/shared/config/gamePalette.ts`, `src/shared/utils/seededRandom.ts`, `backdrop-themes` (theme types). No game feature.
- Consumed by `match` (`gameRenderer`: the first layer on the stage, under the world).

## Decisions

- Its own feature since 2026-11-18 (mover-materials lap 4 preparation): it lived in `arena`, whose one domain is the terrain runtime.
- level-themes (owner, 2026-11-20): the renderer draws whatever theme it is given; theme decisions D1–D4 and the shipped themes are recorded in `backdrop-themes`. Ambient particles draw behind the world, never over players (DESIGN_LANGUAGE layer order).
