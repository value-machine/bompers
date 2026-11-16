/**
 * How a terrain material shows its behaviour without relying on colour (DESIGN_LANGUAGE § 2):
 * plain = smooth slab, breakable = seam grid with pips (cracks near craters), ice = gloss
 * streaks and a white rim. Shared because the catalog defines it and the arena draws it.
 */
export type MaterialSurface = "plain" | "breakable" | "ice";
