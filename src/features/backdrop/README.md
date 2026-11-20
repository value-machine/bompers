# backdrop

## Purpose

The picture behind the arena, drawn from the level's theme: sky, sun or moon, an optional hanging ceiling, far band and clouds, near band, ambient particles, all in screen space with parallax. It knows nothing about the terrain grid or the game state beyond the camera, the world's height and the theme ID the level names.

## Structure

| Layer    | Path                                                                                    | Purpose                                                                                                                                                                                                   |
| -------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types    | `types/backdropTheme.types.ts`                                                          | `BackdropTheme` (sky, disc, ceiling, far / near bands, clouds, ambient, reserved `light`) and its catalog export shape                                                                                    |
| Services | `services/backdropRenderer.ts`                                                          | `createBackdropView(renderer, theme)`, `syncBackdropView`: every layer baked once into textures (tiling bands with opaque fills below; each layer stops where the one in front is opaque, so no overdraw) |
| Services | `services/backdropBands.ts`                                                             | One period of a band (`hills`, `peaks`, `spires`, `rocks`) and of a ceiling, as Graphics to bake; seeded so a theme always looks the same                                                                 |
| Services | `services/backdropAmbient.ts`                                                           | Stars, snow, embers: one baked dot, at most 48 sprites; `ambientPose` is a pure function of time and camera                                                                                               |
| Services | `services/backdropThemeRegistry.ts`                                                     | `BACKDROP_THEMES`, `DEFAULT_BACKDROP_THEME_ID` (`meadow`), `resolveBackdropTheme`, `isBackdropThemeId`, `exportBackdropThemes` (catalog.json `theme`)                                                     |
| Services | `services/meadowTheme.ts`, `nightSkyTheme.ts`, `lavaCaveTheme.ts`, `snowyPeaksTheme.ts` | One recipe per theme                                                                                                                                                                                      |
| API      | `api/backdropApi.ts`                                                                    | Renderer seam (loads Pixi)                                                                                                                                                                                |
| API      | `api/backdropThemesApi.ts`                                                              | Theme registry seam without Pixi: the importer, the level thumbnail and the level kit read it                                                                                                             |

## Dependencies

- `pixi.js`, `src/shared/config/gamePalette.ts`, `src/shared/utils/seededRandom.ts`. No game feature.
- Consumed by `match` (`gameRenderer`: the first layer on the stage, under the world), `level-file` (`data-theme`, W24), `level` (normaliser, thumbnail) and `level-kit` (catalog, prompt).

## Decisions

- Its own feature since 2026-11-18 (mover-materials lap 4 preparation): it lived in `arena`, whose one domain is the terrain runtime.
- level-themes D1 (owner, 2026-11-20): a level picks its backdrop with one root attribute, `data-theme`; left out = `meadow` (the look every level had before); unknown = `meadow` plus W24. One recipe file per theme plus one registry line, like the object recipes; the importer, renderer, catalog.json and the level prompt all read the registry. Theme IDs are never renamed or reused once shipped.
- level-themes D2: theme colours live in `GAME_PALETTE.backdropThemes` and DESIGN_LANGUAGE § 1 World (the meadow keeps `sky` and `backdrop`). Ambient particles draw behind the world, never over players (DESIGN_LANGUAGE layer order).
- level-themes D3: each theme carries a `light` value (tint, strength 0) reserved for scene lighting; nothing reads it yet.
- level-themes D4 (owner): the ink outline stays the same on dark themes; judge it in play before changing anything.
- First themes (owner, level-themes): `night-sky`, `lava-cave`, `snowy-peaks`. Underwater and city rooftops were proposed and wait for a later lap.
