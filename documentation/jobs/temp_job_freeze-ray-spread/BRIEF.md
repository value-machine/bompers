# Freeze-ray spread: brief and plan

**Problem (main a31cc0e):** the owner said the freeze-ray buff "didn't widen the beam or spray". The sim already cast 5 rays over ±7°, each to its own impact (`castRayFan`). But `breathShape` drew one breath along the midpoint of the outer rays' ends, so the beam always looked like a single ray. And ±7° is only about 44 units across at the 180-unit end.

**Owner pick (Stop 1, 2026-11-21, via the orchestrator):** A "Frost fan" and keep the torch as it is (DECISIONS D1, D2).

**Success check:**

- Aimed at the floor in front, the low rays end within 25 units of the holder while the top ray reaches more than 90 units ahead (`rayFan.test.ts`). The test failed on the old numbers and passes on the new ones.
- The spray's outline runs through every ray's own end (`iceShapes.test.ts`).
- Chill and push stay once per blob per step, and the ice per second is unchanged.

**Size:** S. **Edges:** the `combat.freezeRay` tunables, `iceShapes` and its test, the generated level prompt, and the docs. The torch, `castRayFan`, the sim and the renderer's draw order are unchanged.

## Plan (as built)

1. Tunables: `combat.freezeRay` changes to `halfAngleDegrees` 20 and `rays` 7.
2. `breathShape` becomes a fan polygon from the emitter through each grown ray end, with a lighter inside at 80 % reach. Every end gets a puff heart, and ends that landed also get rolling lobes. The head is the middle ray's end, for the release.
3. Run `pnpm level-kit:sync`, then update the README, GAME_JUICE and DESIGN_LANGUAGE.

**Juice:** this is the same moment as before (light tier), and the visual only gets wider. Sounds are unchanged: `freeze-start` and `freeze-loop`, so no new ones.

**Precedent:** sprays and flamethrowers in 2D action games are hit-tested by a fan of rays or a cone and drawn as one cone clipped to each ray's hit. Per-ray clipping is the common way to keep a wide spray from showing through walls.
