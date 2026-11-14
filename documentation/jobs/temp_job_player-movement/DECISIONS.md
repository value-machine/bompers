# Decisions — player-movement

Job: `temp_job_player-movement`
Updated: 2026-11-14

## Closed

| id  | topic                                       | status | choice                                                                                                                                       | source      | notes                                                                                                                    |
| --- | ------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| D1  | What "jumps scale with gravity" means       | closed | fixed take-off speed `jumpSpeed`; apex = jumpSpeed²/(2g), so low-gravity maps jump higher                                                    | loop-refine | clear-winner: GDD § 2 "schaalbaar op basis van zwaartekracht"; a fixed-height jump would make gravity change only timing |
| D2  | Variable jump height                        | closed | releasing jump while rising multiplies vy by `jumpCutMultiplier` once                                                                        | loop-plan   | clear-winner: industry-standard platformer cut, one tunable, deterministic                                               |
| D3  | Accel model                                 | closed | linear approach of target vx: ground accel, ground decel, turn accel (reversing), air accel                                                  | loop-plan   | clear-winner: common platformer model; the curve in motion comes from integrating it + gravity                           |
| D4  | How the renderer learns of landings / jumps | closed | monotonic counters on `PlayerState` (`jumpCount`, `wallJumpCount`, `landCount`, `lastLandingSpeed`); renderer compares with what it last saw | loop-plan   | clear-winner: several sim steps run per frame, a per-step flag would be missed; keeps squash render-only                 |
| D5  | Animation clock                             | closed | `syncPlayersView(view, players, nowMs = performance.now())`                                                                                  | loop-plan   | clear-winner: no change to match's call site; tests can pass a clock                                                     |
| D6  | Contact-shadow ground lookup                | closed | sim computes `groundBelowY` (scan ≤ 240 units) after motion                                                                                  | loop-plan   | clear-winner: renderer has no terrain; scan is ≤ 30 cell rows × 1 rect per player per step                               |

## Open
