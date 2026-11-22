# Freeze-ray cloud shape: brief

**Problem (main, after #150):** the mist puffs read "too much like loose elements". On the options page the merged shape's outline "does not have the correct thickness, and it does not have a single thickness everywhere".

**Owner pick (Stop 1, 2026-11-22, via the orchestrator):** "Cloud shape, no core" (DECISIONS D1). The outline must come from the shared outline system (D3).

**Success check:**

- The spray is closed outline rings (one shape), not circles.
- Aimed at the floor in front, the top reaches far and never goes past the top ray's end by more than a puff's reach.
- The lighter inside stays within the outline.
- The outline stroke equals `inkStroke(outlineWidth("effect", zoom).width, "ice")` at every zoom.
- The arena's outline tests still pass after the ring tracer moves to shared code.

**Size:** S/M. **Edges:**

- Code: the ice feature's `iceShapes` and the breath drawing in `iceRenderer`.
- New shared code: `puffField` and `contourRings`, with the arena's `terrainRings` now calling `traceRings`.
- The docs.
- Out of scope: the effect, the torch and sounds.

**Plan (as built):**

1. Move the ring tracer (marching squares → chained, tidied rings) from the arena to `src/shared/utils/contourRings.ts` as `traceRings(cells)`. The caller supplies each cell's corners. The arena passes its terrain distance field and behaves the same: its 129 arena and fire tests still pass.
2. Add `src/shared/utils/puffField.ts`. It adds each puff's smooth bump to a 4-unit grid, touching only that puff's own neighbourhood, and returns the rings at each level.
3. `breathShape` returns the outline rings at the fill level, the inner rings at a higher level, and the specks. The renderer strokes the outline with `breathStroke(zoom)` (the shared effect width in `inkStroke`), fills it with ice, and fills the inner rings lighter.

**Cost (measured):** about 1.9 ms per frame of geometry for four full-length sprays in Node (2.9 ms before the corner objects were reused). PixiJS tessellation is not included.
