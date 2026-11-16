import type { CraterShape } from "@/shared/types/craterShape.types";

/**
 * Crater shapes as distance rules (terrain-field D5): `craterShapeDistance(shape, dx, dy)` is how
 * far the point (dx, dy) from the blast centre lies from the centre in that shape's own measure,
 * so the crater rim sits where this equals the crater reach ÷ the material's toughness. A new
 * shape is a new `CraterShape` member plus its rule here; the terrain needs no other change.
 */
export function craterShapeDistance(_shape: CraterShape, dx: number, dy: number): number {
  return Math.hypot(dx, dy);
}
