# Decisions — leg-locomotion

Job: `temp_job_leg-locomotion`
Updated: 2026-11-17

## Closed

| id | topic | status | choice | source | notes |
|----|-------|--------|--------|--------|-------|
| D1 | Leg redesign | closed | B, one surface frame: one sprung angle, feet side by side around the body circle, wall pose deleted | loop-refine | Owner pick on the options page (https://claude.ai/artifact/EyrrSWnufKSZdenNsYLGda), relayed by the orchestrator. Folded into the player README and DESIGN_LANGUAGE § 6 |
| D2 | Body lean on a wall | closed | Body stays upright on a wall (the options page showed it leaning away) | loop-build | Orchestrator: leave the root transform alone; other open laps touch it. clear-winner |
| D3 | Step phase source | closed | Distance moved along the surface from position deltas, starting at x | loop-build | Equal to x on flat ground, so the flat run cycle and its tests are unchanged. clear-winner |
| D4 | Planted feet (option C) | closed | Parked as an idea in the player README § Seams, not on the backlog | loop-build | Owner, 2026-11-17: may want it later; backlog tasks can auto-build |
| D5 | Flicker where a slope meets a wall (owner Change on #59) | closed | The render layer holds a ground / wall contact 0.1 s after the sim drops it; feet, lean and shadow read the held contact | loop-build | Cause: the controller flips `grounded` / `wallDir` every step at slopes ≥ 80°. The sim flip is outside this lap's edges and reported to the orchestrator |

## Open

| id | topic | status | options briefly | blocked phase |
|----|-------|--------|-----------------|---------------|

## Log

- 2026-11-17 — D1 opened; options page published
- 2026-11-17 — D1 closed via loop-refine (asked); D2, D3 closed via loop-build (clear-winner); D4 closed (owner)
