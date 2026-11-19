# Brief: Pickup juice pass

Task: "Game juice pass on all pickups" · Lap: temp_job_pickup-juice · Branch: `claude/pickup-juice`

## Problem

The three pickups on main (point orb, weapon crate, headbutt reset) answer unevenly: a taken point orb has no sound and no visual (it vanishes), a crate lands silently and rigidly and vanishes when taken, and neither pops in. Only the headbutt reset was complete.

## Success check

On the PR preview: an orb pops in, squashes when it reaches its point, and when taken throws a pink ring and five mini stars while the collector's HUD score pops; a crate pops in, stretches as it falls, squashes with two dust puffs and a soft `thwap` when it lands, and when taken throws a ring in the weapon colour and four pieces; the headbutt reset looks as before. The orb chime plays only after the owner picks a take on the listening page.

## Juice table (all light tier: no shake, no flash)

| Pickup | Moment             | Sound                                       | Visual                                                        | Window                       |
| ------ | ------------------ | ------------------------------------------- | ------------------------------------------------------------- | ---------------------------- |
| Orb    | appears            | silent                                      | pop-in back-out                                               | squash 150 ms                |
| Orb    | reaches its point  | silent                                      | squash 1.2 × 0.84 springing back, then bob                    | squash 150 ms                |
| Orb    | taken (D1)         | new `orb-collect` (D4, owner listens first) | ring 220 ms, 5 mini stars 320 ms, HUD score pop 150 ms        | effect, squash               |
| Crate  | appears            | silent                                      | pop-in back-out                                               | squash 150 ms                |
| Crate  | falls / lands (D2) | `thwap` at `crouchGain`                     | stretch 0.92 × 1.08 by speed; squash 1.2 × 0.84; 2 dust puffs | squash 150 ms, effect 220 ms |
| Crate  | taken (D3)         | `pickup` (as before)                        | ring in weapon accent 220 ms, 4 pieces 450 ms                 | effect, linger               |
| Reset  | taken / returns    | `pickup` / silent (as before)               | shared ring 220 ms, ghost; pop-in                             | effect, squash               |

## Scope

- In: collectibles sim state for render (ages, rest / grounded time, bursts, orb and landing counters), renderers, HUD score pop, crate landing cue, `feel.pickup` tunables, shared easing extraction (four copies of the back-out ease), ledger rows, README.
- Out: no gameplay change (who can take what, schedules, scoring); no player contact code (parallel lap); level prompt text (parallel lap).

## Edges

| Feature area | Hook point                                               | Ride / new |
| ------------ | -------------------------------------------------------- | ---------- |
| collectibles | sim state, renderers                                     | ride       |
| match        | step args (bursts), HUD score, sound snapshot            | ride       |
| sound        | crate landing cue, later the orb chime                   | ride       |
| shared       | `feel.pickup` tunables, `easing.ts`, `pickupDust` colour | new util   |

## Size

S.
