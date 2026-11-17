# Brief — Fire and flamethrower visuals

Task: Fire and flamethrower visuals (orchestrator run `bompers-game-2`) · Lap: temp_job_fire-visuals · Harness: v0.45.0

## Problem

Owner (2026-11-17): "Fire visuals looked shit on my last test. I didn't see examples yet of the flamethrower visuals." The terrain flames are unoutlined ovals on a grid that blend into cardboard and into the tomato and lemon blobs, burning cardboard shows no front, the spray is three flat triangles, and a held torch shows no flame.

## Success check

The spray's drawn shape is a neck that opens to about half the hit cone and ends in a rolling head wider than the neck, lifted upward, never reaching past the rays; a terrain flame is tallest right after its sample catches and smaller near burn-out (`flameShapes.test.ts`).

## In scope

- Terrain fire as "Sticker flames" (owner pick, options page round 1): pointed tongues under one ink line, one per 2 × 2 burning samples, tall at the front and small behind it, taller on a top edge; burning cardboard darkens before it goes; a white smoke puff with an ink edge per burn-out batch.
- Torch spray as "rolling cloud, half-cone neck" (owner pick, round 3): starts at the nozzle, neck opens to ~45 % of the hit cone, a head of six rolling lobes, the stream lifts slightly, five flames peel off the top and float up, a flare where a ray meets terrain, the head lets go as one puff on release. One ink line around the whole flame.
- Idle flame: a small outlined flame on the nozzle while a torch is held and not spraying.
- Docs: DESIGN_LANGUAGE § 1 Effects and § 9 torch row, GAME_JUICE ledger rows, fire README.

## Out of scope

- Will NOT do: fire sounds (placeholders stay, fire-spread D8) — deferred.
- Will NOT touch: the fire sim, torch reach / cone / push, burn timings, the hit area (render only).
- Will NOT touch: the burning-blob look from #55 (helmet flames, panic hops, moments) — owner picked it; unchanged unless the owner says otherwise.
- Will NOT touch: palette values (ember, amber, pale core, scorch stay).

## Edges

| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| `fire` | `syncFireView` draws scorch, oval flames, fan sprays, then `drawBlobFire` | `services/fireRenderer.ts`; new pure `services/flameShapes.ts` (+ test) | ride — same layers, new drawing |
| `match` | `gameRenderer.syncWorldLayers` passes the fire frame | adds `zoom`, torch holder ids and the torch length to the frame | ride — wiring only |
| docs (`documentation/game`) | DESIGN_LANGUAGE § 1, § 9; GAME_JUICE § 6 | fire rows | ride |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size

S — one renderer rewritten, one pure geometry module with tests, three frame fields, docs. `fire/services` reaches the 10-file layer budget with the two new files, so all drawing stays in `fireRenderer.ts`.
Cut into laps: none.

## Decisions

DECISIONS.md D1–D6.

## Plan

Conflict & compliance: render only (game-juice rule: feedback never changes the sim); colours from `GAME_PALETTE` only; outline through `outlineWidth("effect", zoom)` (DESIGN_LANGUAGE § 3); no new dependency; placement inside `src/features/fire/services/` (allowed, budget 10 / 10 after this lap); `match` imports fire through `api/fireApi.ts`; fire README updated with the feature change.

Performance (architecture § Performance cost risk): one tongue per 2 × 2 burning samples as before (the burning band is 60 units deep: ~150 tongues on a large slab), drawn as 11-point polygons in four batched fills instead of two ellipse passes; char is one circle per block; smoke is capped at 24 puffs. No per-sample work beyond the existing `burningSamples` walk.

Juice table (spec-apply-game-juice):

| Moment | Tier | Sound | Visual | Timing |
|---|---|---|---|---|
| Torch spray (held) | light | `rocket-fire` on start (placeholder) | rolling-cloud flame, grows in | grow-in 0.12 s (`squash` window) |
| Torch released | light | — (the spray's own start cue covers the action; silent like other releases) | head lets go as a rising puff | 0.3 s (`effect` window) |
| Torch held, idle | — | — (a loop, deliberately silent) | nozzle flame | loop |
| Fire spreading | — | — (silent per sample) | outlined tongues, char | loop |
| Fire burn-out (batch) | light | material sound via `terrainDestroyed` | debris + smoke puff | 0.45 s (`linger` window) |

Phases:

1. Acceptance test `src/features/fire/services/flameShapes.test.ts` (fails: module missing). Gate: test red.
2. `flameShapes.ts`: `FLAME_LOOK`, `flameEnvelope`, `terrainTongue`, `tonguePoints`, `sprayFlame`, `releasePuff`, `pilotTongue`. Gate: `pnpm test:run src/features/fire`.
3. `fireRenderer.ts`: char + tongues, spray layers, shed, splashes, release puff, pilot, smoke puffs; `FireFrame` gains `zoom`, `torchHolderIds`, `torchLength`; `gameRenderer` passes them. Gate: `pnpm type-check`, `pnpm lint`.
4. Docs: fire README, DESIGN_LANGUAGE, GAME_JUICE ledger, decision log. Gate: `pnpm validate:structure`, `pnpm validate:feature-size`, `pnpm arch:check`, `pnpm test:run src/features/fire src/shared/config`.
