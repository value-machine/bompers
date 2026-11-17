# fire

## Purpose

Fire on the terrain field, the torch that starts it, and blobs that catch it (owner rules blast-power D4–D8, D18; laps fire-spread b1 and fire-burn b2). Fire is an arrival time per terrain sample: it spreads outward through touching fuel at the same speed every way, never across air, burns each sample away after a while, and scorches the earth it stops at. A blob touching burning terrain or the torch's flame burns for 2 s and loses two chunks over it (the second skipped when it crouches at the end), unless ice, a dive or a bump ends it first. Blasts never light anything (D4).

## Structure

| Layer    | Path                       | Purpose |
| -------- | -------------------------- | ------- |
| Types    | `types/fire.types.ts`      | `FireState` (slice of `GameState`: per-sample `igniteAt`, the pending-ignition heap, the lit FIFO, the burn-out batch, `scorched`, `version`, this step's `sprays`; burning `blobs`, `blobGraceUntil`, recent `blobMoments`, `caughtCounts` / `dousedCounts` for sound), `TorchSpray`, `BurningBlob`, `BlobFireMoment` |
| Services | `services/burningBlobs.ts` | `catchFire`, `isBurning`, `stepBurningBlobs(fire, { terrain, players, contacts, isDiving, now, tunables })` → this step's `BurnDown`s (sim step 3d), `panicInputs(fire, players, inputs)` (the flee, before step 2) |
| Services | `services/blobFireRenderer.ts` | `burningBlobPoses` (drawn panic hop + pinprick pupils as player pose overlays) and `drawBlobFire` (helmet flames, sweat, the moment effects) |
| Services | `services/fireSim.ts`      | `createFireState(grid)`, `canBurn`, `ignite`, `stepFire(fire, grid, { now, tunables })` → this step's `ClearedCells` or null (sim step 3c), `burningSamples` |
| Services | `services/torch.ts`        | `sprayTorch(fire, { terrain, players, holder, tunables, now, dt })`: the torch's ray fan (lights, pushes, records the spray). Combat's `sprayAttack` hook (match wires it) |
| Services | `services/fireRenderer.ts` | `createFireView` / `syncFireView`: scorch and flames over the terrain (`terrainLayer`), torch sprays and burning blobs above the players (`sprayLayer`) |
| API      | `api/fireApi.ts`           | Public seam |

Tests: `services/fireSim.test.ts` (axis arrival = distance / speed, roundness within 8 %, air gap, corner pinch, stone, earth scorch, ice, same-time order, burn-out timing and batching, a blast mid-burn, blasts light nothing) and `services/torch.test.ts` (first fuel per ray, nothing through stone, push in the cone and not through a wall, one end per ray) and `services/burningBlobs.test.ts` (catch from burning cardboard and not out of reach, torch catch credited to the holder, a chunk at 1 s and at 2 s, the second skipped while crouching, no tick after ice, ice steam, dive blow-off, bump passes and not straight back, leaving play, flee with no input, own input kept, no-op when nothing burns).

## How it works

- **Fuel** is a material with `burns` (cardboard). A fuel sample with a `douses` sample (ice) among its 8 neighbours never catches (`canBurn`). Both flags come from the content catalog through the arena's cell slots.
- **Spread** (fire-spread D4, D9): lighting a sample at time t queues each touching fuel sample at t + step / `fire.spreadSpeed` (step = one sample or a diagonal), keeping the earliest time (lazy decrease-key heap, ties by index so the sim stays deterministic). "Touching" is the 8 neighbours, but a diagonal step needs a solid sample beside it, so fuel meeting only at a corner of air does not pass fire. A breakable non-fuel neighbour (earth) is marked `scorched` and stops the front; stone simply blocks, so fire flows around it.
- **Burn-out:** a lit sample burns `fire.burnSeconds`, then waits for the next batch, applied every `fire.burnOutInterval` through the arena's `burnOut` (one writer; the outline and collision follow). The match reports each batch like a crater, as combat `terrainDestroyed` events (cardboard's dust and `thwap`), so a big fire makes a few cues a second, not one per sample.
- **Torch** (blast-power D8; fire-spread D5–D7): while its holder holds fire with fuel left, combat calls the `sprayAttack` hook every step and drains `dt` seconds of fuel (`combat.torch.ammo` = 3 s). `rays` rays fan over ±`halfAngleDegrees` of the aim from the helmet, marching half a sample at a time up to `length`; each stops at the first terrain and lights it when it is fuel. Blobs a ray reaches before terrain get `push` units / s² along the aim on their velocity (like recoil, not through `reactToHit`), at most √(2 · push · length) ≈ 390 units / s, under a blast's push.
- **Burning blobs** (fire-burn D2–D6): a blob catches from a burning terrain sample within its body radius plus one sample, or from a torch ray that reaches it (lit by the holder). Burn damage comes in two ticks (owner D10): 1 chunk at `fire.blob.firstTickSeconds` (1 s), and at `fire.blob.burnSeconds` (2 s) the fire goes out with a second chunk unless the blob is crouching at that moment. The match applies each tick through combat's `applyHit` (kind `burn`, source `fire`, credited to whoever lit or passed it; crouching never halves a tick) and calls `reactToHit` with no push. Before that, a `douses` sample (ice) within the same reach puts it out with steam, a dive wind-up or travel blows it off, and a bump with a blob that isn't burning passes it on (the rival starts its own 2 s; credit goes to the passer). A blob just put out can't catch for `fire.blob.graceSeconds`, so a held bump doesn't pass it straight back. A blob that leaves play just goes out.
- **Flee** (owner D2, D3): `panicInputs` gives a burning blob with no move or crouch input a full move input away from where its fire came from, before the controller runs, so it sprints off ledges like a player holding that way. Any input of the player's own wins; jump and fire are never touched.
- **Look:** flames per 2 × 2 block of burning samples (ellipses in the fire palette, flickering by time), scorch circles on scorched earth (redrawn only when `version` changes), the spray as three nested flame fans from the helmet to the ray ends. A burning blob (owner D1: the options page's variant 2 with variant 1's drawn hops) hops in place on the drawing only (`lift` overlay, a light squash at each touch-down; the body and its shadow stay on the ground), has pinprick pupils, three flames on its helmet and sweat drops flicking off; its moments show for `fire.blob.momentSeconds`: a flame pop on catching, white steam off ice, flames blown back by a dive, a flame ball arcing to the bumped rival, grey smoke when it burns down.

## Dependencies

- `arena` via `api/arenaApi.ts` (`TerrainGrid`, `EMPTY_CELL`, `burnOut`, `ClearedCells`).
- `combat` via `api/combatApi.ts` (`helmetPoint`); combat itself does not import fire (the torch arrives through the `sprayAttack` hook; burn damage is applied by the match).
- `player` via `api/playerApi.ts` (`PlayerState`, `BodyContact`, `BlobPoseOverlay`).
- Shared: `gameTunables` (`fire`, `fire.blob`, `combat.torch`), `gamePalette.fire`, `gameGeometry.types`, `gameInput.types`; `pixi.js` in the renderer.
- Consumed by `match` (state slice, steps 3c and 3d, the input patch, the hook, two render layers, pose overlays, sound counters).

## Decisions

- Lap cut (owner, fire-spread D1): b1 = torch + fire on terrain; b2 = blobs catching fire (2 s, then −1 chunk; ice or a dive puts it out; a bump passes it on), with the burn state kept in this feature.
- Fire sounds are placeholders until fire takes exist (fire-spread D8): the torch start plays `rocket-fire`, burn-outs cardboard's `thwap`; a blob catching fire `rocket-fire`, ice putting it out `clink` (fire-burn D7).
- Burning-blob look and flee are the owner's picks from the options page (fire-burn D1–D3): variant 2's look with drawn-only hops (never real sim hops, so a hop can't throw a jump), full-speed flee with no input, off ledges too, control unchanged.
- Burn damage (owner fire-burn D10, superseding D5's single chunk): two chunks over the 2 s burn, only one when crouching at the end.
- Burn rules (fire-burn D4–D6, D8): a bump passes the fire; each tick is a `burn` hit not halved by crouch; catching reach is the body radius plus one sample; 0.5 s grace after going out.
