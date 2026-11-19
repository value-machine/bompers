# DEVELOPMENT PLAN — level objects, lap 1

Brief: `BRIEF.md` · Decisions: `DECISIONS.md` · Size M · Branch `claude/level-objects`

## Acceptance test

`src/features/level-file/services/levelFileParser.test.ts` › block "level objects":
- `public/level-kit/v2/tree-test-level.html` imports without warnings, with five objects (one per tree variant) whose pieces are terrain.
- An unknown kind gives W22 and no pieces.
- A clamped height gives W23.

`src/features/level-objects/services/objectTerrain.test.ts` checks that a tree's leaves burn through `fireSim` while its trunk does not, and that cold freezes it.

## Conflict & compliance

- **Rules:** architecture (feature granularity, layers, `api/` seams), code-style § Naming, testing, file-placement, game-juice (D10: no new moment), agent-behavior.
- **Placement:** all inside the whitelist, so no protected-file change.
  - `src/features/level-objects/{README.md, api/, services/, types/}`
  - `src/shared/utils/seededRandom.ts` (+ test)
  - `public/level-kit/v2/tree-test-level.html`
- **Imports:**
  - `level-objects` → `level` (types), `content-catalog` (api), shared.
  - `level-file` → `level-objects` (api).
  - `level-kit` → `level-objects` (api).
  - `level` must not import `level-objects`: the `LevelObject` type lives in `level`, the way `LevelMover` does.
- **Naming:** feature `level-objects` (role: placeable object recipes); `ObjectRecipe`, `ObjectVariant`, `ObjectPart`, `placeObject`, `OBJECT_RECIPES`, `seededRandom`, `hashSeed`. The tree recipe is `treeRecipe.ts`, a per-kind file by design.
- **Data:** none stored. Format additive (new role, new colour): no version bump (LEVEL_FORMAT § 8).
- **Performance:** a tree is about 10–60 pieces; the raster cost per piece is bounded by its box. This runs at import only.

## Phases

### 1. Foundation
- `seededRandom.ts`: `seededRandom(seed) → () => number` (mulberry32) and `hashSeed(text) → uint32` (FNV-1a). TDD.
- `level` types: `LevelObject { kind, variant, box: Rect, seed, terrainIndices }`; `LevelDefinition.objects?`; export it from `levelApi`. The normaliser passes it through.
- The `bark` colour: catalog entry, `gamePalette.terrainSwatches.bark`, DESIGN_LANGUAGE § 1 row.

Gate: type-check, the util tests.

### 2. Registry + recipes
- `types/levelObject.types.ts`: `ObjectPart { shape, materialId, colorId, part }`, `ObjectVariant { id, label, aspect, madeOf, build(box, random) }`, `ObjectRecipe { kind, label, height, defaultVariant, variants }`.
- `services/treeRecipe.ts`: the five variants from the options page, rewritten to take a box (w × h) and keep every part at least 8 units thick (D9).
- `services/objectRegistry.ts`: `OBJECT_RECIPES`, `findObjectRecipe`, `exportObjectCatalog()`.
- `services/objectPlacement.ts`: `placeObject({ kind, variant, box, seed })`. It returns `{ ok: false }` for an unknown kind, otherwise the clamped box, the variant, the parts and notes (the corrections).
- Tests:
  - `treeRecipe.test.ts`: the same seed gives the same parts; two seeds differ; parts stay inside the box (± half a sample); catalog materials and colours are known.
  - `objectPlacement.test.ts`: clamping, bottom-centre anchor, unknown or omitted variant.

Gate: these tests, lint.

### 3. Level file
- `levelFileElements`: role `object` (`<rect>`; attributes `data-kind`, `data-variant`, `data-seed`).
- `levelFileParser.readTerrain`: walk terrain and object items in document order; an object becomes its pieces (each with the object's element, so movers pick them up) and a `LevelObject`. W22 and W23 in `levelFile.types` and LEVEL_FORMAT § 7.
- `levelFileMotion.warnContents`: an object is terrain for W13.
- Kit `preview.js` / `preview.css`: know the `object` role (legend entry; no W "unknown role").

Gate: parser tests incl. the acceptance block.

### 4. Kit + prompt (one source)
- `level-kit/services/levelPromptObjects.ts`: a roles-table row and an "### Objects" section built from `exportObjectCatalog()`: kinds, variants, height range, aspect, made-of, how they react.
- `buildKitCatalog` gains `object`; the ID table gains `object` rows.
- `pnpm level-kit:sync`.
- LEVEL_FORMAT § 6 role row; AUTHORING.md role line.

Gate: level-kit tests, `pnpm level-kit:check`.

### 5. Example level + element test
- `tree-test-level.html`: all five trees on stone, earth and cardboard ground, with torch and freeze-ray drops.
- `objectTerrain.test.ts`:
  - Fire lit in an oak's leaves spreads through the leaves and never into the bark.
  - A freeze ray frosts the trunk.

Gate: full `pnpm test:run`, lint, type-check, arch:check, validate:structure, feature-size, feature-docs.

### 6. Docs
- Feature README.
- `level`, `level-file`, `level-kit` and `content-catalog` README rows.
- ARCHITECTURE.md feature list.

## Cleanup

None needed: the change adds new modules, and the touched modules stay within budgets (check the `level-file` services count: 10 files now; this adds none there).

## Pattern & precedent

- **Prefab/blueprint registries:** placed by id plus a transform, with seeded procedural variation (Terraria trees from a world seed; Unity prefabs; Godot scenes).
- **Destructible material grids:** objects compiled into the one grid (Worms, Noita), not separate sprites, so every element system applies.
- **Same-seed reproducibility:** the standard choice for user-authored content that has to look the same on every machine.

## Review contract

- Rules pinned at `git log -1 --format=%h -- .claude/rules`.
- Lenses: architecture/layers, level-format compatibility (additive only), test authority.

## Amendments (plan review, merged)

- **A1 (must-fix, kept as picked):** snow caps are ice, so they are unbreakable. Fire never catches needles touching them, and a breakable piece never paints over them. The owner picked this ("fire can't catch next to it") on the options page, so it stays and is recorded as D4a. It becomes a Stop 2 test point, and `objectTerrain.test.ts` covers it: a snowy pine's needles next to a cap don't catch.
- **A2 (must-fix):** a W13 fix plus a parser test: a tree inside `<g data-motion>` puts all its pieces in the mover, gives no W13, and W14 still runs.
- **A3 (must-fix):** level-file `services/` is at its 10-file budget, so it gets no new file. Reading the attributes goes in `levelFileElements.ts` (`readObjectRequest`); placing stays in level-objects; the parser only loops.
- **A4:** `levelId` goes into `ContentArgs` for the default seed.
- **A5:** the default seed is `hashSeed("<level id>#<element id or object ordinal>")` (D8 updated). Giving an element an `id` makes its tree stable when other trees are inserted before it.
- **A6:** D9 note: the 8-unit minimum assumes the default cell size of 4. Levels with a larger `data-cell-size` may lose thin twigs; this is documented in the prompt and LEVEL_FORMAT.
- **A7:** Performance note: W14 sweeps include tree pieces. The cost is per import and per load of a remembered level. With about 60 pieces a tree it stays within the existing per-piece cost; no change.
- **A8:** add tests `levelPromptObjects.test.ts`, a crater check in `objectTerrain.test.ts`, and a spawn inside a canopy → W5. `OBJECT_RECIPES` with one kind and `terrainIndices` for lap 2 are the owner-approved design (D5), recorded as the exception to code-style's "no registries until a second consumer". An object inside a mover has its indices in both lists; lap 2 settles that.
