# Decisions — dive headbutt

Job: `temp_job_dive-headbutt`
Updated: 2026-11-14

## Closed

| id | topic | status | choice | source | notes |
|----|-------|--------|--------|--------|-------|
| D1 | Home of blob-vs-blob collision | closed | `features/player/services/bodyCollision.ts`, exported through `playerApi` | loop-refine | clear-winner: it works on `PlayerState` bodies and separates them with the controller's terrain-safe move; `shared/` would have to import a feature. Alternatives: `shared/services` (needs `PlayerState` + arena), `features/dive` (collision also applies with no dive) |
| D2 | How a dive steers the controller | closed | Three generic modifiers on `PlayerState` (`steerScale`, `gravityScale`, `jumpLocked`) plus a terrain-hit report; the dive system writes them each step | loop-refine | clear-winner: the player feature stays ignorant of dives; a later stun or rocket recoil uses the same seam. Alternative: a dive branch inside the controller (special-case path) |
| D3 | Three options, one mechanism | closed | One dive state machine; an option is a tunable set in `gameTunables.dive.options` | loop-plan | clear-winner: removing two options in phase 2 is deleting data, not code paths |
| D4 | Body shape for blob contact | closed | Circle (radius = half the width, centre mid-body); terrain keeps the box | loop-plan | clear-winner: round blobs give a contact normal that reads as physics |
| D5 | A blob that cannot give way (standing on ground, hit from above) | closed | Counts as immovable for that contact, so the other one bounces off it | loop-plan | agent-pick: without it a head-stomp is a dead stop |
| D6 | Head-on dive clash | closed | No special rule: both reflect equally and both take the front-zone damage | loop-plan | agent-pick: with the later "front 0" variant a clash becomes bounce-only by configuration |
| D7 | One dive per airtime | closed | A dive spends a charge that returns on ground contact (Pogo also on a hit) | loop-plan | clear-winner: otherwise zero-gravity dives chain into flight. Precedent: air-dash charges in platformers |

## Log

- 2026-11-14 — D1–D2 closed via loop-refine, D3–D7 via loop-plan (clear-winner / agent-pick; orchestrator run, the owner is reached through the orchestrator)
