import type { Graphics } from "pixi.js";
import { inkStroke } from "@/shared/utils/outlineWidth";
import { heartPoints } from "@/shared/utils/shapeGeometry";

export interface InkHeart {
  /** Centre of the heart's box. */
  x: number;
  y: number;
  w: number;
  h: number;
  fill: number;
  /** Visible outline width (the shared `inkStroke`, under the fill); 0 = no outline. */
  outline: number;
}

/**
 * Adds one heart to `g` (owner, health-pickups D2): the shared ink pass first, then the fill on
 * top, so only the outer half of the ink shows (DESIGN_LANGUAGE § 3, line style E). The one heart
 * for the health pickup, the HUD and over-head health hearts and the lost-chunk hearts.
 */
export function drawInkHeart(g: Graphics, heart: InkHeart): Graphics {
  const path = heartPoints(heart.w, heart.h).map((v, i) => v + (i % 2 === 0 ? heart.x : heart.y));
  if (heart.outline > 0) g.poly(path).stroke(inkStroke(heart.outline));
  return g.poly(path).fill(heart.fill);
}
