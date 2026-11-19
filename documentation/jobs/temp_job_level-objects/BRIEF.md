# BRIEF — level objects (lap 1: registry, level file, prompt, trees; static)

## Problem
Level authors (an outside AI using our prompt) can only place raw shapes. We want a library of ready-made objects, starting with trees, that they place by kind + box, built from our existing materials so they behave like terrain (burn, freeze, crater, stain).

## Success check
A level file with `<rect data-role="object" data-kind="tree" …>` entries imports, shows trees in the game's look, and the trees burn/freeze/crater like terrain. The prompt and catalog.json list the objects, generated from the registry. An unknown kind or out-of-range size imports with a Copy-report line.

## Design
- **Object = recipe of parts.** A recipe (`ObjectRecipe`: id, label, variants, size range + default, aspect range, `build(box, rng) → ObjectPart[]`) emits parts; each part = a `Shape2D` (rect / polygon / circle) + material ID + colour ID + part role (trunk, leaves, cap).
- **Compile to terrain.** On import, parts become ordinary `TerrainPiece`s, appended after the authored terrain (an object paints over ground). The level keeps a `LevelObject { kind, variant, box, seed, terrainIndices }` record, the same pattern as `LevelMover`. All terrain behaviour applies with no new code: craters, fire spread and burn-out, freezing, stains, outline/lip/joined fills, collision. An object inside `<g data-motion>` joins that moving part.
- **Level file entry** (forgiving, tiny): `<rect data-role="object" data-kind="tree" data-variant="pine" x y width height fill>`.
  - The box is the size. The object stands on the box's bottom centre and fills its height. Width is clamped to the variant's aspect range and centred, so dimensions always win over defaults.
  - Optional `data-variant` (omitted = a seeded pick from the kind's variants; unknown = the kind's default variant + warning). Optional `data-seed` (integer; default = hash of level id + object ordinal, so the same file always looks the same and two trees differ).
  - Height outside the recipe range is clamped, with a warning. An unknown `data-kind` skips the element, with a warning (not a fallback tree). Snapping is not required.
- **One source.** `OBJECT_RECIPES` registry → `exportObjects()` in catalog.json (via `level-kit:sync`) and a generated prompt section (`levelPromptObjects.ts`, like levelPromptAbilities: only what an author places or sizes: kinds, variants, height range, what they're made of and how they react). New object = one recipe file + one registry line.
- **Physics later (not built).** `LevelObject.terrainIndices` lets a later lap lift an object's pieces out of the static samples into its own body, the same route `MoverBody` took: falling or toppling when its base is blasted, pushes. Parts already carry materials, so mass and toughness can follow.
- **Seeded variation:** a new `src/shared/utils/seededRandom.ts` (mulberry32, ~10 lines; the repo has no seeded RNG; too small for a package).

## Naming / placement
New feature `src/features/level-objects/` (one bounded concept: placeable object recipes). Files: `types/levelObject.types.ts`, `services/objectRegistry.ts`, `services/treeRecipe.ts` (+ test), `services/objectPlacement.ts` (+ test; box/clamp/seed → pieces + record), `api/levelObjectsApi.ts`, README. The whitelist already allows any feature folder with these layers, so there is no protected-file change. Touches: `level` (types + normaliser), `level-file` (parse role `object` + issues), `level-kit` (prompt section + catalog export), `content-catalog` (only if the new `bark` colour is approved), `gamePalette.ts`, DESIGN_LANGUAGE § 1, LEVEL_FORMAT.md § 6.

## Edges
Out: physics/bodies, an in-game editor, a per-part colour override in the file, objects other than trees, and preview.js drawing trees (the offline preview shows the box fill).

## Size and laps
M overall. Lap 1 (M-): registry + level file + prompt/catalog + tree variants, static. Lap 2: object bodies (physics). Lap 3+: more recipes (rocks, bushes, crates, bridges): one file each.

## Precedent
Data-driven prefabs/blueprints placed by id + transform with seeded procedural variation (Terraria tree generation, Unity prefab + random seed, Godot scenes). Compiling objects into the destructible world rather than separate sprites matches Worms/Noita-style destructible terrain, where the world is one material grid.
