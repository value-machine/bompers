# level

## Purpose

The level model the engine runs on: `LevelDefinition` (geometry, spawns, drops, collectibles, bounds, per-level settings) and its normalisation against the content catalog. It maps 1:1 onto the level file format (one self-contained HTML file with inline SVG, `documentation/game/LEVEL_FORMAT.md`). The HTML importer lives in `level-file`; the engine never reads a file format.

## Structure

| Layer      | Path                              | Purpose                                                                                                                                                                                                                                                                                                                                   |
| ---------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types      | `types/levelDefinition.types.ts`  | `LevelDefinition` `{ formatVersion, meta{levelId, title, author?, agent?, description?}, settings{cellSize, gravity, matchDurationS?, weaponIds?}, worldSize{w,h}, terrain[{shape: rect\|polygon\|circle, materialId, colorId?, effectId?, soundId?, behaviorId?}], spawns[], drops[{at}], collectibles[{at, itemId}], bounds{x,y,w,h} }` |
| Services   | `services/levelDefinition.ts`     | `LEVEL_FORMAT_VERSION`, `DEFAULT_LEVEL_SETTINGS` (from the catalog defaults), `normalizeLevelDefinition(level)` → `{ level, warnings }`                                                                                                                                                                                                   |
| Services   | `services/levelThumbnailFrame.ts` | `thumbnailFrame(bounds)`: the 16:10 world window a thumbnail shows (bounds plus a 4 % margin, centred), `THUMBNAIL_ASPECT`                                                                                                                                                                                                                |
| Hooks      | `hooks/useThumbnailFrame.ts`      | `useThumbnailFrame(bounds)`: `thumbnailFrame` memoised on the bounds (components may not import services)                                                                                                                                                                                                                                 |
| Components | `components/LevelThumbnail.tsx`   | `LevelThumbnail { level }`: SVG picture of a level's layout (sky gradient, sun, far hill, every terrain piece in its swatch with the ink outline, moving parts at rest), framed by `useThumbnailFrame`; `role="img"`, label "Layout of <title>". Pure: a new `level` redraws it                                                           |
| API        | `api/levelApi.ts`                 | Public seam                                                                                                                                                                                                                                                                                                                               |

Units: 1 world unit = 1 SVG unit, origin top-left, y down. Spawn points are feet points (bottom-centre of a player). `bounds` is the in-bounds area; falling below its bottom edge eliminates; the side and top kill lines lie far beyond it (match `killZoneOf`). `settings.gravity` multiplies the engine default.

Normalisation applies the format's warnings that make sense on a parsed level and never throws. Each correction adds a warning naming its path (`terrain[3]: unknown material "lava", using "stone"`):

- W4: unknown material → the catalog default material (`stone`); missing or unknown colour → the material's `defaultColor` (unknown warns); unknown effect / sound / behavior → dropped, so the material's default applies; an unknown collectible item → the default collectible; non-weapon IDs in `settings.weaponIds` → removed (a list emptied only by removals is dropped, so the lobby's weapons apply; an empty list stays = no weapons).
- W5: spawn, drop and collectible points outside `bounds` are ignored. Spawn-inside-terrain needs the grid and is the importer's check.
- W8: out-of-range settings → defaults.
- No valid spawn → warning; one spawn is enough, players share it (forgiving-import). The importer places fallback spawns (W19) or rejects with E5 when there is no room.

The structural errors E1–E8 belong to the importer.

Seams for later work:

- **Starting-arena lap:** adds `public/levels/start-arena.html` and lists it first in `BUILT_IN_LEVEL_FILES` (`level-file`).

## Dependencies

- `content-catalog` through `api/contentCatalogApi.ts` (IDs, defaults). `src/shared/types/gameGeometry.types.ts` (`TerrainShape` is `Shape2D`).
- Consumed by `level-file` (importer), `arena` (rasterising) and `match` (`createGameState` normalises and applies settings).

## Decisions

- Levels hold geometry and gameplay data only; looks, sounds and behaviours are string IDs resolved through the content catalog (owner requirement, via orchestrator).
- Unknown IDs resolve to a safe default plus a warning, never a crash (orchestrator).
- Terrain has no role: the material alone decides breakability, the colour is looks only (material-system D1, D5).
- Drops are spawn points only; `settings.weaponIds?` (file `data-weapons`) is an optional level default of the match's weapons setting and wins over the lobby, like `matchDurationS` (level-direction D6, weapons-match-setting D1).
- `settings.cellSize` defaults to the catalog's 4: the arena turns it into the spacing of its distance-field samples (terrain-field D1).
- `objects?: LevelObject[]` (`{ kind, variant, box, seed, rotation?, terrainIndices }`, level-objects D5; `rotation` = the SVG `rotate` turning the whole object, level-orbit D1): placed objects already built into `terrain` pieces by the importer (`level-objects`), named by index like a mover's so a later lap can turn one into its own body. The normaliser passes them through unchanged (terrain order is kept, so the indices stay valid).
- `movers?: LevelMover[]` (`{ motion, pivot, terrainIndices, sounds? }`, sounds = author-declared `move` / `end` IDs, LEVEL_FORMAT § 11): moving parts keep their pieces in `terrain` at the rest pose and name them by index; the arena leaves them out of its static samples and runs each as a moving body. Motion is geometry, not a catalog behaviour; `data-behavior` stays for catalog behaviours (moving-parts D1, D2, D10).
- A mover's pose is a pure function of round time, `motionPose(motion, t)` in `src/shared/utils/levelMotion.ts`; no mover state is stored (moving-parts D7).
- Runtime (lap B-1): each mover is a kinematic body with its own local distance field (never in the static field); riders are carried by the contact point's velocity; a mover is made of its material like any terrain: blasts crater it by toughness, fire burns it, the freeze ray frosts it (mover-materials D1, D2); rockets explode on them without craters, homing ignores them, crates ride, the spawn picker skips covered spawns; same slab + one-rule outline. Crush (lap B-2): a player squeezed between a mover and static terrain or another mover is eliminated, credit to the last hitter (owner, moving-parts D11–D16, D13).
- The level thumbnail lives here, beside the model it draws, not in `level-file` or `lobby`: any feature that lists levels can show it (level-file-handle lap; owner picked the thumbnail strip, 2026-11-18). It reuses the game palette (`gamePalette.ts`), so its colours follow DESIGN_LANGUAGE § 1.
