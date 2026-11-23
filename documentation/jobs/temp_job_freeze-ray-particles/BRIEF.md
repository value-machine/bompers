# Freeze-ray particles ("Cold travels"): brief and plan

**Problem (main 351e245):** the freeze ray was a ray fan recast every step, and its puffs were drawn along this step's rays. Changing aim moved every puff at once, so a spinning holder (for example after a dive) sprayed one way instead of spiralling. The owner said: "beam particles shouldn't relocate mid-flight when you change aim … the spray should spiral around you."

**Owner pick (via the orchestrator, 2026-11-23):** "Cold travels". The puffs are sim particles that keep their emitted heading and speed. Chill, push, frost and ice happen where the puffs actually are. The render shape that was already approved stays (DECISIONS D1).

**Success check (tests):**

- A puff keeps its heading after the aim changes.
- A spinning emitter leaves a spiral.
- Floor-aim reach holds: the low puffs land within 25 units, the top puffs more than 90 units ahead.
- Chill is added once per step however many puffs touch a blob.
- The beam clash still works: the game-level clash tests pass, and a clash reach stops the puffs.
- Measured cost with four holders.

**Size:** M.

**Edges:**

- New shared code: `sprayParticles` (and its types).
- Ice: the freeze ray, the shapes, the renderer, and the ice feed's reseed rule.
- Match: the wiring, the sound snapshot and the renderer frame.
- Physics objects: chill from puffs.
- Tunables and the docs.

Out of scope: the torch's behaviour and look, and the beam-clash math.

## Plan (as built)

1. Write `src/shared/utils/sprayParticles.ts`, the spray particle stream, named by role:
   - `emitSpray` sends `rate × dt` puffs across the fan at the current aim, spread by a golden-ratio sequence, staggered inside the step and capped.
   - `advanceSpray` marches each puff half a sample at a time with the ray fan's `solidAt` / `bodyAt`: it stops and bursts on fields, passes through bodies (reporting them once per step with a summed heading), and dies at its reach.
   - `rayFan.ts` exports those two helpers.
2. Ice: `IceState.rays` becomes `sprays` (`FreezeSpray`: stream, held, heldAt, reach).
   - `sprayFreezeRay` emits and flies the held spray. `stepFreezeSprays` flies the sprays that were let go.
   - The step's landed samples feed `feedCold`, shared per body as before. Chill and push apply once per blob per step.
3. The ice front reseeds only when every landing is on new ground or after a pause. Without this, puffs landing on a new sample each step restarted the front every step (15.6 ms a frame with four holders; 0.54 ms after the fix).
4. Match: `stepFreezeSprays` runs at the start of `stepElements`, before the objects read the puffs. Sound reads `held`. The renderer frame passes `combat.freezeRay`.
5. Render: `breathShape` draws each puff where it is (from the emitter knob, growing with distance, fading over the last 15 %) plus rolling bursts, melted by `puffFieldRings` with the shared ink stroke. The grow-in and release memo are gone: the particles grow in and fly on by themselves. The old render-only `sprayStream` is deleted.

**Juice:** the same moments (light tier) and the same sounds. The release no longer draws three puffs; the puffs in flight fly on and burst. That moment's ledger row is updated.

**Precedent:** flamethrowers and sprays in 2D action games are particle emitters whose particles keep their launch velocity, with hit tests per particle and per-target hit throttling. This lap follows that pattern.
