# blob-fire

## Purpose

Blobs on fire (owner rules blast-power D7, fire-burn D1–D10; split out of `fire` in the blob-fire-split lap): a blob catches from burning ground or a torch's flame, burns for 2 s and loses two chunks over it, passes the fire on with a bump, and goes out by ice, a dive or the timer. The fire on the ground and the torch are the `fire` feature.

## Structure

| Layer    | Path                           | Purpose |
| -------- | ------------------------------ | ------- |
| Types    | `types/blobFire.types.ts`      | `BlobFireState` (slice of `GameState`: burning `blobs`, `blobGraceUntil`, recent `blobMoments`, `caughtCounts` / `dousedCounts` for sound), `BurningBlob`, `BlobFireMoment` |
| Services | `services/burningBlobs.ts`     | `catchFire`, `douseBlob`, `isBurning`, `stepBurningBlobs(blobFire, { fire, terrain, players, contacts, isDiving, now, tunables })` → this step's `BurnDown`s (sim step 3d), `panicInputs(fire, players, inputs)` (the flee, before step 2)                                                                                                    |
| Services | `services/blobFireRenderer.ts` | `burningBlobPoses` (drawn panic hop + pinprick pupils, blob-look's `PANIC_PUPIL_SCALE`, as blob pose overlays) and `drawBlobFire` (helmet flames, sweat, the moment effects)                                                                                                                                                                           |
| API      | `api/blobFireApi.ts`           | Public seam |

Tests: `services/burningBlobs.test.ts` (catch from burning cardboard and not out of reach, catch from a burning moving part, a chunk at 1 s and at 2 s, the second skipped while crouching, no tick after ice, ice steam, dive blow-off, bump passes and not straight back, leaving play, flee with no input, own input kept, no-op when nothing burns).

## How it works

- **Burning blobs** (fire-burn D2–D6): a blob catches from a burning terrain sample within its body radius plus one sample, or from a torch ray that reaches it (lit by the holder). Burn damage comes in two ticks (owner D10): 1 chunk at `fire.blob.firstTickSeconds` (1 s), and at `fire.blob.burnSeconds` (2 s) the fire goes out with a second chunk unless the blob is crouching at that moment. The match applies each tick through combat's `applyHit` (kind `burn`, source `fire`, credited to whoever lit or passed it; crouching never halves a tick) and calls `reactToHit` with no push. Before that, a `douses` sample (ice) within the same reach puts it out with steam, a dive wind-up or travel blows it off, and a bump with a blob that isn't burning passes it on (the rival starts its own 2 s; credit goes to the passer). A blob just put out can't catch for `fire.blob.graceSeconds`, so a held bump doesn't pass it straight back. A blob that leaves play just goes out. "Ice next to it" is a sample whose fire reaction is `douses` (the material × element table, mover-materials lap 3).
- **Flee** (owner D2, D3): `panicInputs` gives a burning blob with no move or crouch input a full move input away from where its fire came from, before the controller runs, so it sprints off ledges like a player holding that way. Any input of the player's own wins; jump and fire are never touched.
- **State and wiring:** `createBlobFireState()` is its own slice (`GameState.blobFire`). `stepBurningBlobs(blobFire, { fire, terrain, … })` reads the fire feature's ground fires (`fire.grounds`, one per body of the arena) to find burning samples near a blob; a moving part is searched in the part's own frame. The torch does not call this feature: `sprayTorch` returns the blobs its flame reached and the match calls `catchFire` for each, lit by the holder. The layer (`createBlobFireView` / `syncBlobFireView`) is added by the match above the torch sprays; `burningBlobPoses` gives the player layer its pose overlays.

## Dependencies

- `fire` via `api/fireApi.ts` (`FireState`, type only).
- `arena` via `api/arenaApi.ts` (`TerrainGrid`, `EMPTY_CELL`, `bodyGrids`, `terrainBodies`, `bodyWorldPoint`).
- `combat` via `api/combatApi.ts` (`helmetPoint`), `player` via `api/playerApi.ts` (`PlayerState`, `hurtCenter` (where a blob's fire moments centre: lower while crouched, crouch-sink D4), `BodyContact` (read for who touched whom; its per-blob `aImpulse` / `bImpulse` are unused here), ); `blob-look` via `api/blobLookApi.ts` (`BlobPoseOverlay`, `PANIC_PUPIL_SCALE`).
- Shared: `gameTunables` (`fire.blob`), `gamePalette.fire`, `gameInput.types`; `pixi.js` in the renderer.
- Consumed by `match` (state slice, step 3d, the input patch, the torch's reached blobs, one render layer, pose overlays, sound counters).

## Decisions

- Split out of `fire` (blob-fire-split, 2026-11-18, orchestrator): `fire` held two domain concepts (fire on the ground; blobs on fire) and was at its file budget, which blocked the mover-materials laps. Behaviour, tunables (`fire.blob`), colours and sounds are unchanged; the tunables keep their place under `fire`.
- No import cycle with `fire`: this feature reads `fire`'s state; `fire` never imports this feature (the torch returns the blobs it reached).
- Ice on a blob (ice-frozen-blobs D6): `douseBlob` puts a burning blob out with steam, for ice terrain next to it and, called by the match, for a freeze ray's chill or an ice block on the blob itself. The match takes the ice off in the same step, so a flame on an ice block melts it and the blob does not burn from that touch (the 0.5 s grace).
- Burning-blob look and flee are the owner's picks from the options page (fire-burn D1–D3): variant 2's look with drawn-only hops (never real sim hops, so a hop can't throw a jump), full-speed flee with no input, off ledges too, control unchanged.
- Burn damage (owner fire-burn D10, superseding D5's single chunk): two chunks over the 2 s burn, only one when crouching at the end.
- Burn rules (fire-burn D4–D6, D8): a bump passes the fire; each tick is a `burn` hit not halved by crouch; catching reach is the body radius plus one sample; 0.5 s grace after going out.
