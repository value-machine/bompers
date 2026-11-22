# Freeze-ray cloud shape: decisions

- **D1 (owner, 2026-11-22, options page):** "Cloud shape, no core": the mist puffs melt into one silhouette whose outline morphs as they flow. It was picked over the same shape with a denser core.
- **D2 (agent, code-style F2/F3):** the marching-squares ring tracer moved out of the arena into `src/shared/utils/contourRings.ts` (`traceRings`). It is now the second use, and its name describes its role. The arena re-exports the `OutlineRing` type, so existing imports keep working.
- **D3 (owner):** the outline is one ink line from the shared outline system: the effect width (as the ice and the torch use) in `inkStroke`, stroked on the fill-level contour. It is not a second, lower contour level, because that band's width would change with the field.
- **D4 (agent):** the inner, lighter level has no stroke. The release puffs keep their circles.
