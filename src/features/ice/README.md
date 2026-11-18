# ice

## Purpose

Frozen ground on the terrain field and the freeze ray that makes it (owner, ice-element D1–D6; lap 1 of the ice element). It is the mirror of the fire feature on the same system: the cold is an arrival time per terrain sample on the shared sample front (`src/shared/utils/sampleFront.ts`), and a frozen patch is drawn as the same kind of shape as a fire's body. The difference is what feeds it: fire feeds itself through fuel and runs on time; the cold is fed only by a freeze ray on terrain and runs on distance from the beam, a fixed amount of ice per second. Frozen blobs are lap 2.

## Structure

| Layer    | Path                       | Purpose |
| -------- | -------------------------- | ------- |
| Types    | `types/ice.types.ts`       | `IceState` (slice of `GameState`: a `ColdFeed` per player slot, per-sample `thawAt`, the frozen FIFO, this step's `rays`), `ColdFeed` (a distance front from where the beam touches, its ice budget), `FreezeRayBeam` |
| Services | `services/iceSim.ts`       | `createIceState(grid)`, `canFreeze`, `feedCold(ice, grid, { slot, samples, now, dt, tunables })` (one step of a ray on the ground), `stepIce(ice, grid, { now })` (thaw; sim step 3e) |
| Services | `services/freezeRay.ts`    | `sprayFreezeRay(ice, { terrain, players, holder, tunables, now, dt })`: the ray's fan (freezes, pushes, records the beam). Match wires it into combat's `sprayAttack` hook |
| Services | `services/iceShapes.ts`    | Pure geometry the renderer fills: `ICE_LOOK`, `frozenShapes` (body slabs per row run of 2 × 2 blocks, top-edge lips, gloss streaks), `breathShape` (the ray's neck, rolling head and snow specks), `breathRelease` (the head's puffs when the ray stops) |
| Services | `services/iceRenderer.ts`  | `createIceView` / `syncIceView`: frozen ground over the terrain (`terrainLayer`, redrawn only when the terrain's `frozenVersion` changes), freeze rays above the players (`beamLayer`) |
| API      | `api/iceApi.ts`            | Public seam |

Tests: `services/iceSim.test.ts` (the touched sample freezes at once; the same amount of ice per second; a round patch on fresh ground; stops when the ray lets go; an old patch stays put while the beam freezes elsewhere on the same ground; a beam inside a patch pushes out its nearest edge; never across air; never into ice terrain; thaws after the frozen time; freezes again later; frozen stone grips like ice; a blast leaves frozen cardboard whole; a spreading fire stops at frozen cardboard; freezing a burning sample puts it out). `services/iceShapes.test.ts` (the breath is thin at the emitter and widest by the head, its head sits near the end of the middle ray, it lifts toward the top of the screen either way, it is shorter while growing in, specks fall below it, the release rises and shrinks to nothing, timings inside the juice windows; a frozen patch costs a slab per row run and a lip on top edges only). The torch's thaw is tested in the fire feature (`torch.test.ts`).

## How it works

- **Frozen is a flag, not a material.** The arena keeps `TerrainGrid.frozen` per sample (`setSampleFrozen`, `thawAround`). While set, the sample keeps its material and colour but behaves like ice in the arena's own queries: it grips with the ice material's friction, blasts do not cut it, and fire cannot enter it. This feature decides when the flag is set and cleared.
- **The cold flows from the beam** (owner, D3, D8): every second of beam on the ground makes the same amount of ice (`ice.freezeAreaPerSecond`, 3600 units²), and each bit lands on the nearest ground that is not frozen yet, measured through solid ground from the samples the beam touches. Fresh ground gets a round patch; a beam held inside a frozen patch pushes out the patch's nearest edge; frozen ground the beam is not near never moves. `feedCold(ice, grid, { slot, samples, now, dt, tunables })` does it once per ray per step: it adds the step's ice to the ray's budget (fractions carry over) and runs the shared sample front on distance instead of time (`advanceFront` with `until`, the same front fire spreads on; 8 neighbours with the corner rule, never across air), walking over frozen samples for free and freezing unfrozen ones until the budget is spent. Each player slot has its own feed (`IceState.feeds`); its distances start over when the beam touches other samples or comes back after a pause. Ice terrain (`douses`) is never entered or crossed. A step's search walks at most 4000 samples, so aiming at the middle of a very large patch costs a bounded amount and carries on next step. Let go and nothing grows.
- **Thaw** (D5): a frozen sample thaws by itself `ice.frozenSeconds` after it froze (a FIFO, as fire's burn-out; `stepIce`). The torch's flame thaws sooner (fire feature, `thawAround`); a sample frozen again gets a new entry and the old one is skipped.
- **Fire** (D6): a spreading fire stops at frozen ground and does not come back for it when it thaws. Freezing a burning sample puts it out (the fire feature drops it when `frozenVersion` changes); it stays standing. The torch always thaws frozen ground first and lights it on a later step only if it is fuel. Match runs `stepIce` before `stepFire`.
- **Freeze ray** (D1): combat calls the `sprayAttack` hook every step its holder holds fire and drains `dt` seconds of charge (`combat.freezeRay.ammo` = 3 s). The fan is the shared `castRayFan` (`src/shared/utils/rayFan.ts`), the torch's too: `rays` rays over ±`halfAngleDegrees` up to `length`, each stopping at the first terrain. Blobs the beam reaches first get `push` units / s² along the aim.
- **Look:** frozen ground in the game's ice colours (`gamePalette.ice`, the `frost` swatch): one body slab per row run of frozen blocks, a lighter lip where the block above is not frozen, a white gloss streak on about one block in nine inside the patch. It lies inside the terrain's own ink line. The ray is "Cold breath" (owner, D9): the torch's twin in the ice colours, drawn in ink first and in colour on top. A thin neck leaves the emitter (15 units along the aim), flares and lifts a little toward the end, and ends in a head where the breath lands: a round heart wider than the neck's end, so the neck's corners never show (owner, 2026-11-18), with six lobes rolling around it; six white snow specks drift down under it. It grows in over 0.12 s and, on release, the head lets go as three puffs that rise and shrink (0.3 s). It follows the middle ray the sim cast, so it lands where the ice does; the head is wider than the narrow line the ray actually hits.

## Dependencies

- `arena` via `api/arenaApi.ts` (`TerrainGrid`, `getCellInfo`, `isFrozenSample`, `setSampleFrozen`).
- `combat` via `api/combatApi.ts` (`helmetPoint`); combat does not import ice.
- `player` via `api/playerApi.ts` (`PlayerState`).
- Shared: `sampleFront`, `rayFan`, `blockSlabs`, `gameTunables` (`ice`, `combat.freezeRay`), `gamePalette.ice`; `pixi.js` in the renderer.
- Consumed by `match` (state slice, step 3e, the hook, two render layers).

## Decisions

- Concept (owner, ice-element D1, 2026-11-18, after the options page): a freeze ray, held like the torch, on the same system as fire. Not the freeze rocket, the frost spray or the snow lobber from the page.
- The ice grows only while the ray feeds it (owner, D3), and it grows where the beam points (owner, D8, 2026-11-18, after playing the first build): the first build ran one fire-like front on one feed clock, so on a large surface old edges grew while the owner froze somewhere else. Picked over forgetting waiting edges on release and over growing only edges near the beam. The price, accepted: ice no longer spreads at a steady speed like fire (a big patch's edge moves slower than a small one's); in return a crate always makes the same amount of ice.
- Shared mechanism (D4, code-style F2): fire's front was extracted to `shared/utils/sampleFront`, the torch's ray fan to `shared/utils/rayFan`, and the cluster's row-run slabs to `shared/utils/blockSlabs`, each reading the grid as a plain `SampleField`. Fire and ice both call them; nothing is copied. They live in shared, not in the arena or combat, because both features were at their file budget and none of the three needs anything but the grid's samples.
- Frozen behaves like ice and thaws by itself after 8 s (D5, derived from "the same system as fire": a burning piece burns out, a frozen one thaws).
- Fire and ice (owner, D6): spreading fire stops at frozen ground; the torch always thaws it and burns it only if it would have burned anyway.
- Ray look (owner, D9, 2026-11-18, options page): "Cold breath", over a snow stream, a pulse beam and an ice lance, and over the thin tapering beam of the first build ("spray design needs work").
- Sounds are placeholders until a listening page (D2): the ray's start plays `clink`.
- Starting values (D7, D8): `ice.freezeAreaPerSecond` 3600 units² (a 3 s crate makes a round patch of about 59 units radius inside a slab), `ice.frozenSeconds` 8, beam 180 units long and ±3°, push 300.
