import type { Rect, Vec2 } from "@/shared/types/gameGeometry.types";

/**
 * The arena's one out-of-bounds rule: only falling past the bottom edge of the level's
 * `bounds` is lethal. The sides and the top are open space — gravity always brings a body back
 * down, and past the sides there is no ground, so drifting out ends below the bottom unless the
 * player steers back (open-map-edges D1–D3). Used by players (elimination), rockets and crates.
 */
export const isOutOfBounds = (bounds: Rect, point: Vec2): boolean => point.y > bounds.y + bounds.h;
