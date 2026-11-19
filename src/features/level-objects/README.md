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
- **Physics objects (later):** a separate class from the terrain objects here (see Decisions, object classes). They will be whole bodies with whole-object state; they are not built from `terrainIndices`. `LevelObject.terrainIndices` stays the record of which terrain pieces a terrain object became (an object inside a moving part has its indices in the mover's list too).

## Dependencies

- `level`, `arena`, `fire`, `ice` and `content-catalog` (tests only: the objects-as-terrain checks), `src/shared/utils/seededRandom.ts`, `src/shared/types/gameGeometry.types.ts`.
- Consumed by `level-file` (importer: `placeObject`) and `level-kit` (catalog.json `object`, ID table rows, the prompt's Objects section).

## Decisions

- **Object classes (owner, 2026-11-19, after the object-physics feasibility check):** partial destruction, per-sample burning and per-sample freezing belong only to **terrain objects**. Trees, and anything else compiled to terrain pieces, stay terrain: they crater, burn and freeze per sample and never move, so a piece cut off by a blast or fire stays where it is. **Physics objects** (later, e.g. crates, balls, logs) may move and fall but are never partially destroyed: burning, freezing and damage apply to the object as a whole. One object is never both. Why: per-sample fire, frost and stains on bodies that fall and rotate cost too much (an always-on sim cost 3–5× main's step, and burning worst steps went past the frame budget). Fire also never crosses between bodies, so a tree as its own body would no longer light the ground it stands on. Trees therefore get no physics.
- Recipes compile to terrain pieces at import; the level keeps a `LevelObject` record with `terrainIndices` (owner, D2, D5). The registry with one kind is the owner-approved exception to code-style's "no registries until a second consumer".
- Trees are existing materials plus the new colour `bark` (owner, D4): living trunks earth (crater, only scorch), leaves cardboard (burn away), snow caps ice (unbreakable; needles touching them never catch, D4a), the dead tree cardboard throughout.
- Default seed: FNV-1a of `<level id>#id:<element id>` (else `<level id>#<object ordinal>`) (D8); `data-seed` overrides.
- The thinnest part is 8 units, two samples at the default cell size (D9); a coarser `data-cell-size` can lose twigs.
- No new juice moment: trees use their materials' terrain moments (D10).
