import { BALL_RECIPE } from "@/features/level-objects/services/ballRecipe";
import { KART_RECIPE } from "@/features/level-objects/services/kartRecipe";
import { TREE_RECIPE } from "@/features/level-objects/services/treeRecipe";
import type {
  ExportedObjectRecipe,
  ObjectRecipe,
  PhysicsObjectVariant,
} from "@/features/level-objects/types/levelObject.types";

/**
 * The object registry: every object kind a level may place, the single source for the importer,
 * the kit's catalog.json and the level prompt (level-objects D5). A new object = one recipe file
 * plus one line here; kinds and variant IDs are never renamed or reused once shipped.
 */
export const OBJECT_RECIPES: Readonly<Record<string, ObjectRecipe>> = {
  [TREE_RECIPE.kind]: TREE_RECIPE,
  [BALL_RECIPE.kind]: BALL_RECIPE,
  [KART_RECIPE.kind]: KART_RECIPE,
};

/** The recipe for a kind (own keys only, so `toString` is unknown), or null. */
export const findObjectRecipe = (kind: string): ObjectRecipe | null =>
  Object.prototype.hasOwnProperty.call(OBJECT_RECIPES, kind)
    ? (OBJECT_RECIPES[kind] ?? null)
    : null;

/** A variant of any recipe by id, or null (`V` is that recipe's variant shape). */
export const findObjectVariant = <V extends { id: string }>(
  recipe: { variants: readonly V[] },
  id: string
): V | null => recipe.variants.find((variant) => variant.id === id) ?? null;

/** A physics object's variant (its body), or null when the kind is not a physics kind. */
export function findPhysicsVariant(kind: string, id: string): PhysicsObjectVariant | null {
  const recipe = findObjectRecipe(kind);
  if (recipe?.objectClass !== "physics") return null;
  return findObjectVariant(recipe, id);
}

type AuthorFacing = Pick<
  ExportedObjectRecipe["variants"][number],
  "id" | "label" | "aspect" | "madeOf"
>;

/** Either class's variants as the fields every variant has (for authors and the prompt). */
const authorFacing = (variants: readonly AuthorFacing[]): readonly AuthorFacing[] => variants;

/** Plain JSON copy of the registry (catalog.json `object`). */
export function exportObjectCatalog(): ExportedObjectRecipe[] {
  return Object.values(OBJECT_RECIPES).map((recipe) => ({
    kind: recipe.kind,
    objectClass: recipe.objectClass,
    label: recipe.label,
    height: { ...recipe.height },
    defaultVariant: recipe.defaultVariant,
    variants: authorFacing(recipe.variants).map(({ id, label, aspect, madeOf }) => ({
      id,
      label,
      aspect: { ...aspect },
      madeOf,
    })),
  }));
}
