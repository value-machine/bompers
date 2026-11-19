import { TREE_RECIPE } from "@/features/level-objects/services/treeRecipe";
import type {
  ExportedObjectRecipe,
  ObjectRecipe,
  ObjectVariant,
} from "@/features/level-objects/types/levelObject.types";

/**
 * The object registry: every object kind a level may place, the single source for the importer,
 * the kit's catalog.json and the level prompt (level-objects D5). A new object = one recipe file
 * plus one line here; kinds and variant IDs are never renamed or reused once shipped.
 */
export const OBJECT_RECIPES: Readonly<Record<string, ObjectRecipe>> = {
  [TREE_RECIPE.kind]: TREE_RECIPE,
};

/** The recipe for a kind (own keys only, so `toString` is unknown), or null. */
export const findObjectRecipe = (kind: string): ObjectRecipe | null =>
  Object.prototype.hasOwnProperty.call(OBJECT_RECIPES, kind)
    ? (OBJECT_RECIPES[kind] ?? null)
    : null;

export const findObjectVariant = (recipe: ObjectRecipe, id: string): ObjectVariant | null =>
  recipe.variants.find((variant) => variant.id === id) ?? null;

/** Plain JSON copy of the registry (catalog.json `object`). */
export function exportObjectCatalog(): ExportedObjectRecipe[] {
  return Object.values(OBJECT_RECIPES).map((recipe) => ({
    kind: recipe.kind,
    label: recipe.label,
    height: { ...recipe.height },
    defaultVariant: recipe.defaultVariant,
    variants: recipe.variants.map(({ id, label, aspect, madeOf }) => ({
      id,
      label,
      aspect: { ...aspect },
      madeOf,
    })),
  }));
}
