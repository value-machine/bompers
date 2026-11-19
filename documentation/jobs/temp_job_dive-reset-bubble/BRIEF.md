# Brief — Headbutt reset: jelly bubble look

Task: redesign the dive-reset (headbutt reset) pickup's look · Lap: temp_job_dive-reset-bubble · Orchestrator thread "dive-reset diamond redesign"

## Problem
The headbutt reset is an aqua diamond with an ink up-chevron. The chevron says "up / jump", while the move it gives back is a headbutt dash in any direction, and while the pickup is gone a flat ghost outline gives no sense of when it is back. The owner picked option C, "Jelly bubble", from the options page (four looks next to today's diamond).

## Success check
In the match, the reset is a wobbling aqua bubble, a little smaller than a blob, with a cream headbutt glyph (helmet dome + speed lines) inside and no eyes, helmet or feet. A blob that dives through it pops it into 6 aqua droplets and a thin ring; a faint bubble then regrows on the point over the 2.5 s respawn and pops back in solid. Unit tests in `diveRefills.test.ts` (the services layer is at its 10-file budget): every new duration sits in its juice window, the idle wobble stays inside the squash band, the regrow grows from small to near full across the respawn, and the bubble is smaller than a blob.

## In scope
- `collectibles/services/diveRefillRenderer.ts`: bubble look, wobble, pop (droplets + ring), regrowing ghost, pop-in. Render only, from sim state.
- Blob-confusion guard (owner accepted the risk; cheap mitigations): radius 0.42 × touch box (12.6 vs blob ≈ 13.2–14), no eyes / helmet / feet, aqua (no player hue), cream glyph, its own wobble.
- Docs: DESIGN_LANGUAGE § 1 Effects row, GAME_JUICE § 6 rows "Headbutt reset taken / returns", `gamePalette.ts` comment, collectibles README.

## Out of scope
- Will NOT change: the touch box (`collectibles.diveRefill.size` 30), respawn time, sim, sound (`pickup` pitched by the collector; return stays silent), level kit.
- Will NOT touch other pickups (the parallel "juice pass: all pickups" thread owns those).

## Edges
| Feature area | Hook point | Ride / new |
|---|---|---|
| collectibles | `diveRefillRenderer.ts` + test, README | ride |
| shared config | `gamePalette.diveRefill` comment only | ride |
| docs | DESIGN_LANGUAGE § 1, GAME_JUICE § 6 | ride |

Size: S.

## Plan
Acceptance test: the look block in `src/features/collectibles/services/diveRefills.test.ts` (fails until the bubble look exports its timings and poses).

Juice table (spec-apply-game-juice):
| Moment | Tier | Sound | Visual | Window |
|---|---|---|---|---|
| Idle | — (loop) | — | wobble sx · sy = 1, ±4 % per axis, 1.1 s, plus the 2.5-unit bob | loop, squash band |
| Taken | light | `pickup` (pitched by the collector), unchanged | bubble pops: 6 aqua droplets with an ink edge fly out and fall, thin aqua ring | `linger` 0.32 s |
| Gone | — | — | faint bubble regrows on the point, 20 % → 95 % of the radius | the respawn (2.5 s) |
| Returns | — (silent, unchanged) | — | solid bubble pops in, back-out | `squash` 0.15 s |

1. Write the failing test; export the look's pure parts (`DIVE_REFILL_LOOK`, `diveRefillWobble`, `diveRefillPhase`).
2. Redraw the renderer as the bubble; keep `syncDiveRefillLayer` / `createDiveRefillLayer` signatures so `collectiblesRenderer.ts` is untouched.
3. Docs rows. Gate: `pnpm type-check`, `pnpm lint`, the collectibles tests, `pnpm validate:structure`, `pnpm arch:check`.
