# backdrop-themes

## Purpose

The catalogue of level backdrop themes: what each theme looks like (sky, sun or moon, ceiling, far and near bands, clouds, ambient particles, a reserved lighting value), picked by a level with `data-theme`. Data only, no Pixi: the importer, the level thumbnail and the level kit read it without loading the renderer; `backdrop` draws it.

## Structure

| Layer    | Path                                                                                                                                  | Purpose                                                                                                                                               |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types    | `types/backdropTheme.types.ts`                                                                                                        | `BackdropTheme` and its parts (bands, ceiling, disc, ambient), the catalog export shape                                                               |
| Services | `services/backdropThemeRegistry.ts`                                                                                                   | `BACKDROP_THEMES`, `DEFAULT_BACKDROP_THEME_ID` (`meadow`), `resolveBackdropTheme`, `isBackdropThemeId`, `exportBackdropThemes` (catalog.json `theme`) |
| Services | `services/meadowTheme.ts`, `nightSkyTheme.ts`, `lavaCaveTheme.ts`, `snowyPeaksTheme.ts`, `underwaterTheme.ts`, `cityRooftopsTheme.ts` | One recipe per theme                                                                                                                                  |
| API      | `api/backdropThemesApi.ts`                                                                                                            | Public seam: registry and types                                                                                                                       |

## Dependencies

- `src/shared/config/gamePalette.ts` (theme colours). No feature.
- Consumed by `backdrop` (renderer), `level-file` (`data-theme`, W24), `level` (normaliser, thumbnail), `level-kit` (catalog, prompt) and `match` (picks the level's theme).

## Decisions

- level-themes D1 (owner, 2026-11-20): a level picks its backdrop with one root attribute, `data-theme`; left out = `meadow` (the look every level had before); unknown = `meadow` plus W24. One recipe file per theme plus one registry line, like the object recipes. Theme IDs are never renamed or reused once shipped.
- Split from `backdrop` in the same lap: theme recipes are content that changes for a different reason than the renderer, and readers that only need IDs and colours stay free of Pixi.
- level-themes D2: theme colours live in `GAME_PALETTE.backdropThemes` and DESIGN_LANGUAGE § 1 World (the meadow keeps `sky` and `backdrop`).
- level-themes D3: each theme carries a `light` value (tint, strength 0) reserved for scene lighting; nothing reads it yet.
- level-themes D4 (owner): the ink outline stays the same on dark themes; judge it in play.
- Themes shipped (owner, Q1 B): `meadow` (default), `night-sky`, `lava-cave`, `snowy-peaks`, `underwater`, `city-rooftops`. Levels: `slush-bowl`, `bobsled-run`, `crystal-gap` snowy-peaks; `bonfire-bridge` lava-cave; `piston-works` city-rooftops; kit sample `orbit-test` night-sky. No level uses `underwater` yet.
