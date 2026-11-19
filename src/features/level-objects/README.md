# level-objects

## Purpose

Ready-made objects a level places by kind and box (`<rect data-role="object" data-kind="tree" …>`), built procedurally from a seed out of catalog materials. A placed object compiles to ordinary terrain pieces, so it collides, craters, burns, freezes and stains like terrain with no code of its own (level-objects D2, D5). The registry is the single source of object kinds for the importer, the kit's `catalog.json` and the level prompt.

## Structure

| Layer    | Path                              | Purpose |
| -------- | --------------------------------- | ------- |
| Types    | `types/levelObject.types.ts`      | `ObjectPart` (shape + material + colour + part role), `ObjectVariant` (id, label, aspect range, `madeOf` line, `build(box, random)`), `ObjectRecipe` (kind, label, height range, default variant, variants), `ObjectPlacementRequest`, `ObjectPlacement`, `ExportedObjectRecipe` |
| Services | `services/objectParts.ts`         | Part builders in a recipe's local frame (origin = base, y up negative): `circlePart`, `polygonPart`, `limbPart` (tapered bar), `toBox` (to world), `insideLocalBox`; `MIN_PART_THICKNESS` = 8 (two samples, D9) |
| Services | `services/treeRecipe.ts`          | `TREE_RECIPE`: variants `oak`, `pine`, `snowy-pine`, `palm`, `dead` (owner picks D1, D4; options page "Level Tree Options"); height 96–480 (D11) |
| Services | `services/objectRegistry.ts`      | `OBJECT_RECIPES`, `findObjectRecipe` (own keys only), `findObjectVariant`, `exportObjectCatalog()` |
| Services | `services/objectPlacement.ts`     | `placeObject(request)`: unknown kind → `{ ok: false }`; variant asked / default when unknown / seeded pick when omitted; height clamped to the kind, width to the variant's aspect, on the same bottom centre; parts built from `seededRandom(seed)`; `notes` = each correction |
| API      | `api/levelObjectsApi.ts`          | Public seam |

Seams for later work:

- **New object:** one recipe file in `services/` (variants with `build(box, random)` from the part builders, every part ≥ `MIN_PART_THICKNESS`) plus one line in `OBJECT_RECIPES`, then `pnpm level-kit:sync` (catalog.json, ID tables, prompt). Kinds and variant IDs are never renamed or reused once shipped.
- **Physics (lap 2):** the level keeps a `LevelObject` per placed object (`level` types) with the `terrainIndices` of its pieces, like a mover's, so an object can be lifted out of the static samples into its own body. An object inside a moving part has its indices in both lists; lap 2 settles which owns them.

## Dependencies

- `level` (types), `content-catalog` (tests only), `src/shared/utils/seededRandom.ts`, `src/shared/types/gameGeometry.types.ts`.
- Consumed by `level-file` (importer: `placeObject`) and `level-kit` (catalog.json `object`, ID table rows, the prompt's Objects section).

## Decisions

- Recipes compile to terrain pieces at import; the level keeps a `LevelObject` record with `terrainIndices` (owner, D2, D5). The registry with one kind is the owner-approved exception to code-style's "no registries until a second consumer".
- Trees are existing materials plus the new colour `bark` (owner, D4): living trunks earth (crater, only scorch), leaves cardboard (burn away), snow caps ice (unbreakable; needles touching them never catch, D4a), the dead tree cardboard throughout.
- Default seed: FNV-1a of `<level id>#<element id, else object ordinal>` (D8); `data-seed` overrides.
- The thinnest part is 8 units, two samples at the default cell size (D9); a coarser `data-cell-size` can lose twigs.
- No new juice moment: trees use their materials' terrain moments (D10).
