# Freeze-ray spray look: brief

**Problem (main, after #149):** the owner said the frost fan looks "like a cone with a couple of points on there. It should look like a spray … The fire flamethrower has that better."

**Owner pick (Stop 1, 2026-11-22, via the orchestrator):** B "Mist cloud" (DECISIONS D1). The owner first picked A, the frost jet, and changed it to B.

**Success check:**

- Every mist puff stays on the ray it travels along, including when aimed at the floor in front.
- The top ray's mist reaches far while the low ray's mist ends at the floor.
- Puffs grow as they travel, and burst puffs appear only where a ray landed.

**Size:** S. **Edges:** the ice feature's `iceShapes` and the breath drawing in `iceRenderer`, a new shared `sprayStream`, and the docs. Out of scope: the effect (7 rays over ±20°, chill, push, ice), the torch's drawing, and sounds.

**Plan (as built):**

1. `src/shared/utils/sprayStream.ts` places puffs that travel along each ray to its own end, growing as they go. It is pure and deterministic, and it has its own tests.
2. `breathShape` builds the stream along the grown rays, plus burst puffs where rays landed, plus snow specks. The renderer draws all of it in ink first, so the cloud has one outline, then the ice body colour, then the lighter inside, which covers each puff in its first 80 % of the ray.

**Juice:** this is the same moment as before (light tier), and only the look changes. Sounds are unchanged.

**Precedent:** sprays such as extinguishers, foam and mist are commonly drawn in 2D games as particles emitted along the hit cone and clipped at each hit, so the visual and the hitbox agree.
