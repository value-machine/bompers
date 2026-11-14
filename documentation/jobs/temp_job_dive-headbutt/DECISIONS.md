# Decisions — dive headbutt

Job: `temp_job_dive-headbutt`
Updated: 2026-11-14

## Closed

| id | topic | status | choice | source | notes |
|----|-------|--------|--------|--------|-------|
| D1 | Home of blob-vs-blob collision | closed | `features/player/services/bodyCollision.ts`, exported through `playerApi` | loop-refine | clear-winner: it works on `PlayerState` bodies and separates them with the controller's terrain-safe move; `shared/` would have to import a feature. Alternatives: `shared/services` (needs `PlayerState` + arena), `features/dive` (collision also applies with no dive) |
| D2 | How a dive steers the controller | closed | Three generic modifiers on `PlayerState` (`steerScale`, `gravityScale`, `jumpLocked`) plus a terrain-hit report; the dive system writes them each step | loop-refine | clear-winner: the player feature stays ignorant of dives; a later stun or rocket recoil uses the same seam. Alternative: a dive branch inside the controller (special-case path) |
| D3 | Three options, one mechanism (phase 1) | closed | One dive state machine; an option was a tunable set | loop-plan | clear-winner: phase 2 removed two options by deleting data; superseded by D8 |
| D4 | Body shape for blob contact | closed | Circle (radius = half the width, centre mid-body); terrain keeps the box | loop-plan | clear-winner: round blobs give a contact normal that reads as physics |
| D5 | A blob that cannot give way (standing on ground, hit from above) | closed | Counts as immovable for that contact, so the other one bounces off it | loop-plan | agent-pick: without it a head-stomp is a dead stop |
| D6 | Head-on dive clash | closed | No special rule: both reflect equally and both take the front-zone damage | loop-plan | agent-pick: with the later "front 0" variant a clash becomes bounce-only by configuration |
| D7 | One dive per airtime | closed | A dive spends a charge that returns on ground contact (Pogo also on a hit) | loop-plan | clear-winner: otherwise zero-gravity dives chain into flight. Precedent: air-dash charges in platformers |
| D8 | Which dive | closed | Cannonball's launch + Pogo's ricochet off other blobs; terrain never bounces the dive | owner (via orchestrator) | asked at Stop 2 of phase 1: "I want the cannonball launch and the pogo ricochet when bouncing off heads and other characters, but I don't want the bouncing off the ground" |
| D9 | Wall-bonk stun | closed | 30 frames (250 ms) + a hop back at 25 % of the speed | loop-build | agent-pick: the owner asked for a fair stun; the prototype's 54 frames was the harshest part of Cannonball |
| D10 | Terrain ricochet as a hurt reaction | closed | A reusable tumble in `features/player` (`reactToHit`): hard hits (impulse ≥ `tumble.minImpulse`, or a back hit) make the victim ricochet off floors and walls; the attacker never does | owner (via orchestrator) | "the pogo effect from the dive... we should retain that for if a character is hurt in a certain way" |
| D11 | Sim order with combat | closed | players → body contacts → combat (its `unarmedAttack` hook calls `requestDive`) → dive (hits through `applyHit`) → respawn (also resets the dive) | loop-build | clear-winner: a fire press starts the wind-up on the same step; `dive → combat → player` keeps features acyclic |
| D12 | Own rocket blast | closed | The shooter is pushed but never tumbled | owner (via orchestrator) | keeps rocket jumping in control (GDD § 2) |

## Log

- 2026-11-14 — D1–D2 closed via loop-refine, D3–D7 via loop-plan (clear-winner / agent-pick; orchestrator run, the owner is reached through the orchestrator)
- 2026-11-14 — D8 closed by the owner (relayed by the orchestrator), D9 via loop-build (agent-pick)
- 2026-11-14 — D10 closed by the owner (relayed by the orchestrator)
- 2026-11-14 — D11 via loop-build (clear-winner), D12 approved by the orchestrator
