# Brief: fire on rotating parts (bug, size S)

**Problem (owner):** on rotating parts (trees on a turning wheel) the flames don't point up, and they come from the wrong blocks.

**Proven cause:** a part's fire layer is turned with the part (`placePoseLayer`), and the flames were built in the part's own grid: top-edge blocks, roots (`edgeAbove`) and tongue direction all used the part's rest-pose "up". Turned half round, the flames sat on the part's world bottom and hung down. Acceptance test against the old code: the flames' world bounds lay below the part (`fireSim.test.ts` § flames on a turned part, failing before the fix).

**Fix (structural, one mechanism):** the arena's body functions map between a body's grid and the world (`bodyWorldPoint` / `bodyLocalPoint`) and sample one body's distance world-up (`bodyDistanceAt`, `bodyEdgeAbove`). `flameBlocks` places each burning sample in the world-aligned block its centre is in, roots and opens it world-up, and the tongues are shaped in the world and mapped into the part's layer. Static terrain is unchanged (same sample points). `edgeAbove` had no other consumer and is removed.

**Success check:** flames on a part turned half round root on its world top edge and rise above it; all fire and arena tests pass.

**Edges:** scorch and the fire body stay in the part's frame (they are the part's own surface). Ice: the frozen coat rides the part correctly; only its lighter lip follows the part's own top. Not changed here (it would mean redrawing the frost contour every frame on a turning part); reported to the orchestrator.

**Supersedes:** mover-materials-l2 D4 (agent pick: flames turn with the part, flagged as a follow-up if the owner dislikes it).
