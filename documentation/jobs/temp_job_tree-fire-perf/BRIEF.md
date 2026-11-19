# Tree fire performance (tree-fire-perf)

**Problem (owner, after #120):** "performance suffers a lot when I'm burning trees in multiple places" (Tree Grove).

**Success check:** measured frame cost on Tree Grove with 1, 3 and 6 simultaneous fires drops, with the same look (tile output = whole-march output, tested).

**Size:** S. Edges: arena terrain renderer + surfaces, terrain grid (per-chunk versions), fire body drawing. No sim behaviour change.

## Measurement (headless Vitest bench, Node, Tree Grove 600 × 275 samples, 161 pieces, 20 s of fire, 60 steps/s)

Harness: parse `public/levels/tree-grove.html`, ignite N evenly spread burnable columns, per frame time `stepFire` / `syncTerrainView` / `syncFireView`. Not committed (kept out of the suite for cost).

| | 1 fire | 3 fires | 6 fires |
|---|---|---|---|
| sim ms/frame | 0.02 | 0.15 | 0.29 |
| terrain rebuild per burn-out batch, before → after (avg) | 177 → 3.7 ms | 187 → 9.5 ms | 196 → 14.8 ms |
| fire render ms/frame, before → after (avg) | 0.18 → 0.16 | 8.1 → 1.6 | 16.5 → 3.4 |
| fire render max frame, before → after | 3.8 → 8.4 | 62 → 8.2 | 62 → 25.5 |
| worst frame, before → after | 239 → 15 ms | 258 → 39 ms | 298 → 38 ms |

## Proven hotspots

1. **Terrain view, every burn-out batch (4×/s):** whole-grid `terrainRings` (15 ms) and all 10 slot fill layers redrawn over boxes spanning the level (~170 ms): slot layers are cumulative ("this slot and every later one"), and tree slots sit all over the level, so every layer met every change. Independent of fire count: a hitch on every batch.
2. **Fire body, every frame a fire spreads:** one `markedRegion` over all burning samples of the body, so with fires in several places the contour, rings and hot inside marched the box spanning all of them.

Sim (fire front, burn-out field upkeep) was never the cost: it already works per chunk.

## Fix (structural)

- `surfaceTiles`: a body's contour cells cut into 32 × 32 tiles; `terrainContour` / `terrainRings` take `cells` to march one tile. Fills are per cell and a ring cut at a tile edge ends inside the next tile's round-capped stroke, so tiles side by side draw the same.
- Terrain view: per tile rings, ink and slot fills; a dirty chunk redraws only the tiles whose read samples it holds (no pad: every distance change goes through `writeSample`, which marks its own chunk). A tile draws only the slots it holds: a missing slot's layer is the next held slot's layer there, painted over it in full.
- Fire body (`fireBody.ts`): per tile, from the burning / fresh samples that tile reads (one-sample margin for `markedRegion`'s neighbour share); a tile is redrawn only when its samples, its terrain (`boxShapeVersion` over new per-chunk `chunkVersions`) or the ink width change.
