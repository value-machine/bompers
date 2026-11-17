/**
 * Surface pattern a terrain material draws over its colour (DESIGN_LANGUAGE § 2): plain = smooth
 * slab (stone, and breakable earth and cardboard alike, owner terrain-curves D5), ice = gloss
 * streaks and a white rim. Shared because the catalog defines it and the arena draws it.
 */
export type MaterialSurface = "plain" | "ice";
