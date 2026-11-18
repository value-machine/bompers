import { useMemo } from "react";
import { thumbnailFrame } from "@/features/level/services/levelThumbnailFrame";
import type { Rect } from "@/shared/types/gameGeometry.types";

/** The thumbnail's world window for `bounds`, recomputed only when the bounds change. */
export function useThumbnailFrame(bounds: Rect): Rect {
  const { x, y, w, h } = bounds;
  return useMemo(() => thumbnailFrame({ x, y, w, h }), [x, y, w, h]);
}
