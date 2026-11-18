# ice

## Purpose

Frozen ground on the terrain field and the freeze ray that makes it (owner, ice-element D1–D6; lap 1 of the ice element). It is the mirror of the fire feature on the same system: the cold is an arrival time per terrain sample on the shared sample front (`src/shared/utils/sampleFront.ts`), and a frozen patch is drawn as the same kind of shape as a fire's body. The difference is what feeds it: fire feeds itself through fuel, the cold spreads only while a freeze ray is on terrain. Frozen blobs are lap 2.

## Structure

| Layer    | Path                       | Purpose |
| -------- | -------------------------- | ------- |
| Types    | `types/ice.types.ts`       | `IceState` (slice of `GameState`: the cold `front`, its feed clock `fedSeconds` / `fedAt`, per-sample `thawAt`, the frozen FIFO, this step's `rays`), `FreezeRayBeam` |
| Services | `services/iceSim.ts`       | `createIceState(grid)`, `canFreeze`, `feedCold(ice, grid, { index, now })` (a ray touches a sample), `stepIce(ice, grid, { now, dt, tunables })` (sim step 3e) |
| Services | `services/freezeRay.ts`    | `sprayFreezeRay(ice, { terrain, players, holder, tunables, now, dt })`: the ray's fan (freezes, pushes, records the beam). Match wires it into combat's `sprayAttack` hook |
| Services | `services/iceShapes.ts`    | Pure geometry the renderer fills: `ICE_LOOK`, `frozenShapes` (body slabs per row run of 2 × 2 blocks, top-edge lips, gloss streaks), `beamShape` (the beam outline, its core, the frost bursts) |
| Services | `services/iceRenderer.ts`  | `createIceView` / `syncIceView`: frozen ground over the terrain (`terrainLayer`, redrawn only when the terrain's `frozenVersion` changes), freeze rays above the players (`beamLayer`) |
| API      | `api/iceApi.ts`            | Public seam |

Tests: `services/iceSim.test.ts` (the touched sample freezes at once; the same distance every way while fed; stops when the ray lets go; grows on when fed again; never across air; never into ice terrain; thaws after the frozen time; freezes again later; frozen stone grips like ice; a blast leaves frozen cardboard whole; a spreading fire stops at frozen cardboard; freezing a burning sample puts it out). The torch's thaw is tested in the fire feature (`torch.test.ts`).

## How it works

- **Frozen is a flag, not a material.** The arena keeps `TerrainGrid.frozen` per sample (`setSampleFrozen`, `thawAround`). While set, the sample keeps its material and colour but behaves like ice in the arena's own queries: it grips with the ice material's friction, blasts do not cut it, and fire cannot enter it. This feature decides when the flag is set and cleared.
- **Spread** (D3, D4): `feedCold` queues the touched sample on the front at the feed clock and marks the step as fed. `stepIce` runs the feed clock by `dt` only on a fed step and then advances the front to it (`advanceFront`, the same code fire uses): through touching terrain of any material at `ice.spreadSpeed`, the 8 neighbours with the corner rule, never across air. Ice terrain (`douses`) is never entered. Let go of the ray and the clock stands still, so the ice stays where it is; feed it again and it grows on from its edge.
- **Thaw** (D5): a frozen sample thaws by itself `ice.frozenSeconds` after it froze (a FIFO, as fire's burn-out). The torch's flame thaws sooner (fire feature, `thawAround`); `stepIce` notices through the terrain's `frozenVersion` and forgets those samples, so they can freeze again.
- **Fire** (D6): a spreading fire stops at frozen ground and does not come back for it when it thaws. Freezing a burning sample puts it out (the fire feature drops it when `frozenVersion` changes); it stays standing. The torch always thaws frozen ground first and lights it on a later step only if it is fuel. Match runs `stepIce` before `stepFire`.
- **Freeze ray** (D1): combat calls the `sprayAttack` hook every step its holder holds fire and drains `dt` seconds of charge (`combat.freezeRay.ammo` = 3 s). The fan is the shared `castRayFan` (`src/shared/utils/rayFan.ts`), the torch's too: `rays` rays over ±`halfAngleDegrees` up to `length`, each stopping at the first terrain. Blobs the beam reaches first get `push` units / s² along the aim.
- **Look:** frozen ground in the game's ice colours (`gamePalette.ice`, the `frost` swatch): one body slab per row run of frozen blocks, a lighter lip where the block above is not frozen, a white gloss streak on about one block in nine inside the patch. It lies inside the terrain's own ink line. The beam is drawn in ink first and in pale frost on top with a white core, tapering from the emitter to the ray ends the sim cast, with a pulsing frost burst where a ray touches terrain.

## Dependencies

- `arena` via `api/arenaApi.ts` (`TerrainGrid`, `getCellInfo`, `isFrozenSample`, `setSampleFrozen`).
- `combat` via `api/combatApi.ts` (`helmetPoint`); combat does not import ice.
- `player` via `api/playerApi.ts` (`PlayerState`).
- Shared: `sampleFront`, `rayFan`, `blockSlabs`, `gameTunables` (`ice`, `combat.freezeRay`), `gamePalette.ice`; `pixi.js` in the renderer.
- Consumed by `match` (state slice, step 3e, the hook, two render layers).

## Decisions

- Concept (owner, ice-element D1, 2026-11-18, after the options page): a freeze ray, held like the torch, on the same system as fire. Not the freeze rocket, the frost spray or the snow lobber from the page.
- The ice grows only while the ray feeds it (owner, D3). The feed clock is one clock for all frozen ground: feeding any patch also moves a front left waiting elsewhere. Accepted for lap 1; a clock per patch is the fix if it shows.
- Shared mechanism (D4, code-style F2): fire's front was extracted to `shared/utils/sampleFront`, the torch's ray fan to `shared/utils/rayFan`, and the cluster's row-run slabs to `shared/utils/blockSlabs`, each reading the grid as a plain `SampleField`. Fire and ice both call them; nothing is copied. They live in shared, not in the arena or combat, because both features were at their file budget and none of the three needs anything but the grid's samples.
- Frozen behaves like ice and thaws by itself after 8 s (D5, derived from "the same system as fire": a burning piece burns out, a frozen one thaws).
- Fire and ice (owner, D6): spreading fire stops at frozen ground; the torch always thaws it and burns it only if it would have burned anyway.
- Sounds are placeholders until a listening page (D2): the ray's start plays `clink`.
- Starting values (D7): `ice.spreadSpeed` 40 units / s, `ice.frozenSeconds` 8, beam 180 units long and ±3°, push 300.
