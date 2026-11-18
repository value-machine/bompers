import type { Rect } from "@/shared/types/gameGeometry.types";

/** Thumbnail frame: 16:10, the bounds centred with a small margin. */
export const THUMBNAIL_ASPECT = 16 / 10;
const FRAME_MARGIN = 0.04;

/**
 * The world-space window a level thumbnail shows: the level bounds plus a margin, widened or
 * heightened to `THUMBNAIL_ASPECT` around the bounds' centre, so every card has the same shape.
 */
export function thumbnailFrame(bounds: Rect): Rect {
  const w0 = bounds.w * (1 + 2 * FRAME_MARGIN);
  const h0 = bounds.h * (1 + 2 * FRAME_MARGIN);
  const w = Math.max(w0, h0 * THUMBNAIL_ASPECT);
  const h = w / THUMBNAIL_ASPECT;
  return { x: bounds.x + bounds.w / 2 - w / 2, y: bounds.y + bounds.h / 2 - h / 2, w, h };
}
