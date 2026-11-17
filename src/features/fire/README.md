# fire

## Purpose

Fire on the terrain field and the torch that starts it (owner rules blast-power D4–D8, D18; lap fire-spread b1). Fire is an arrival time per terrain sample: it spreads outward through touching fuel at the same speed every way, never across air, burns each sample away after a while, and scorches the earth it stops at. The torch is the only thing that lights it so far; blobs catching fire comes in lap b2. Blasts never light anything (D4).

## Structure

| Layer    | Path                       | Purpose |
| -------- | -------------------------- | ------- |
| Types    | `types/fire.types.ts`      | `FireState` (slice of `GameState`: per-sample `igniteAt`, the pending-ignition heap, the lit FIFO, the burn-out batch, `scorched`, `version`, this step's `sprays`), `TorchSpray` |
| Services | `services/fireSim.ts`      | `createFireState(grid)`, `canBurn`, `ignite`, `stepFire(fire, grid, { now, tunables })` → this step's `ClearedCells` or null (sim step 3c), `burningSamples` |
| Services | `services/torch.ts`        | `sprayTorch(fire, { terrain, players, holder, tunables, now, dt })`: the torch's ray fan (lights, pushes, records the spray). Combat's `sprayAttack` hook (match wires it) |
| Services | `services/fireRenderer.ts` | `createFireView` / `syncFireView`: scorch and flames over the terrain (`terrainLayer`), torch sprays above the players (`sprayLayer`) |
| API      | `api/fireApi.ts`           | Public seam |

Tests: `services/fireSim.test.ts` (axis arrival = distance / speed, roundness within 8 %, air gap, corner pinch, stone, earth scorch, ice, same-time order, burn-out timing and batching, a blast mid-burn, blasts light nothing) and `services/torch.test.ts` (first fuel per ray, nothing through stone, push in the cone and not through a wall, one end per ray).

## How it works

- **Fuel** is a material with `burns` (cardboard). A fuel sample with a `douses` sample (ice) among its 8 neighbours never catches (`canBurn`). Both flags come from the content catalog through the arena's cell slots.
- **Spread** (fire-spread D4, D9): lighting a sample at time t queues each touching fuel sample at t + step / `fire.spreadSpeed` (step = one sample or a diagonal), keeping the earliest time (lazy decrease-key heap, ties by index so the sim stays deterministic). "Touching" is the 8 neighbours, but a diagonal step needs a solid sample beside it, so fuel meeting only at a corner of air does not pass fire. A breakable non-fuel neighbour (earth) is marked `scorched` and stops the front; stone simply blocks, so fire flows around it.
- **Burn-out:** a lit sample burns `fire.burnSeconds`, then waits for the next batch, applied every `fire.burnOutInterval` through the arena's `burnOut` (one writer; the outline and collision follow). The match reports each batch like a crater, as combat `terrainDestroyed` events (cardboard's dust and `thwap`), so a big fire makes a few cues a second, not one per sample.
- **Torch** (blast-power D8; fire-spread D5–D7): while its holder holds fire with fuel left, combat calls the `sprayAttack` hook every step and drains `dt` seconds of fuel (`combat.torch.ammo` = 3 s). `rays` rays fan over ±`halfAngleDegrees` of the aim from the helmet, marching half a sample at a time up to `length`; each stops at the first terrain and lights it when it is fuel. Blobs a ray reaches before terrain get `push` units / s² along the aim on their velocity (like recoil, not through `reactToHit`), at most √(2 · push · length) ≈ 390 units / s, under a blast's push.
- **Look:** flames per 2 × 2 block of burning samples (ellipses in the fire palette, flickering by time), scorch circles on scorched earth (redrawn only when `version` changes), the spray as three nested flame fans from the helmet to the ray ends.

## Dependencies

- `arena` via `api/arenaApi.ts` (`TerrainGrid`, `EMPTY_CELL`, `burnOut`, `ClearedCells`).
- `combat` via `api/combatApi.ts` (`helmetPoint`); combat itself does not import fire (the torch arrives through the `sprayAttack` hook).
- `player` via `api/playerApi.ts` (`PlayerState`).
- Shared: `gameTunables` (`fire`, `combat.torch`), `gamePalette.fire`, `gameGeometry.types`; `pixi.js` in the renderer.
- Consumed by `match` (state slice, step 3c, the hook, two render layers).

## Decisions

- Lap cut (owner, fire-spread D1): b1 = torch + fire on terrain; b2 = blobs catching fire (2 s, then −1 chunk; ice or a dive puts it out; a bump passes it on), with the burn state kept in this feature.
- Fire sounds are placeholders until fire takes exist (fire-spread D8): the torch start plays `rocket-fire`, burn-outs cardboard's `thwap`.
