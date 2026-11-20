import type { Rect } from "@/shared/types/gameGeometry.types";
import { seededRandom } from "@/shared/utils/seededRandom";
import { rotateParts } from "@/features/level-objects/services/objectParts";
import {
  findObjectRecipe,
  findObjectVariant,
} from "@/features/level-objects/services/objectRegistry";
import type {
  ObjectPlacement,
  ObjectPlacementRequest,
  ObjectRecipe,
  ObjectVariant,
} from "@/features/level-objects/types/levelObject.types";

/**
 * Places one object (level-objects D3): the box's height is clamped to the kind's range, its
 * width to the variant's aspect range, and the result keeps the box's bottom centre. Variant:
 * the asked one, the kind's default when unknown, or a seeded pick when omitted. A rotation
 * turns the built object as a whole about its point (level-orbit D1). Pure.
 */

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));
const round = (n: number): number => Math.round(n * 100) / 100;

function chooseVariant(
  recipe: ObjectRecipe,
  request: ObjectPlacementRequest,
  notes: string[]
): ObjectVariant {
  const fallback = findObjectVariant(recipe, recipe.defaultVariant) ?? recipe.variants[0]!;
  if (request.variant === undefined) {
    const pick = Math.floor(seededRandom(request.seed ^ 0x9e3779b9)() * recipe.variants.length);
    return recipe.variants[pick] ?? fallback;
  }
  const found = findObjectVariant(recipe, request.variant);
  if (found) return found;
  notes.push(`unknown ${recipe.kind} variant "${request.variant}", using "${fallback.id}"`);
  return fallback;
}

/** The box clamped to the recipe's height and the variant's aspect, on the same bottom centre. */
function clampBox(
  box: Rect,
  limits: { recipe: ObjectRecipe; variant: ObjectVariant },
  notes: string[]
): Rect {
  const { height } = limits.recipe;
  const { aspect } = limits.variant;
  const h = clamp(box.h, height.min, height.max);
  if (h !== box.h) notes.push(`height ${box.h} is outside ${height.min}–${height.max}, using ${h}`);
  const w = clamp(box.w, round(h * aspect.min), round(h * aspect.max));
  if (w !== box.w) {
    notes.push(`width ${box.w} does not fit a ${limits.variant.id} ${h} tall, using ${w}`);
  }
  return { x: round(box.x + (box.w - w) / 2), y: round(box.y + box.h - h), w, h };
}

export function placeObject(request: ObjectPlacementRequest): ObjectPlacement {
  const recipe = findObjectRecipe(request.kind);
  if (!recipe) return { ok: false, reason: "unknown-kind" };
  const notes: string[] = [];
  const variant = chooseVariant(recipe, request, notes);
  const box = clampBox(request.box, { recipe, variant }, notes);
  const upright = variant.build(box, seededRandom(request.seed));
  const { rotation } = request;
  const turned = rotation !== undefined && rotation.degrees % 360 !== 0;
  return {
    ok: true,
    kind: recipe.kind,
    variant: variant.id,
    box,
    seed: request.seed,
    ...(turned && { rotation }),
    parts: turned ? rotateParts(upright, rotation) : upright,
    notes,
  };
}
