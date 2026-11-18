# Decisions — ice-element

Job: `temp_job_ice-element`
Updated: 2026-11-18

Task (owner, 2026-11-18, via the orchestrator): do for every element what was done for fire, one by one: a projectile piece and an effect on the map's materials. Ice is next; a further element is decided after it is in.

## Closed

| id | topic | status | choice | source | notes |
|----|-------|--------|--------|--------|-------|
| D1 | Ice concept | closed | A freeze ray, held like the torch, on the same system as fire: frozen is a state of the ground that spreads through touching terrain and is drawn as the same kind of shape as a fire | loop-refine | Owner, 2026-11-18, in chat after the options page. Not taken from the page: A Frost breath (surface coat), B Snowpack (builds ice), C Cold snap (freeze rocket) |
| D2 | Sounds | closed | Not on the options page; placeholders from the existing bank until a listening page (the ray's start plays `clink`) | loop-refine | clear-winner: the task says so, and fire did the same (fire-spread D8) |
| D3 | What feeds the ice | closed | It spreads like fire only while the source feeds it, so while the freeze ray is on terrain; let go and it stops where it is | loop-refine | Owner, 2026-11-18. Built as one feed clock for all frozen ground (agent, loop-plan): feeding one patch also moves a front left waiting elsewhere; a clock per patch is the fix if it shows |
| D4 | Shared mechanism (code-style F1, F2) | closed | Extract, do not copy: fire's front → `shared/utils/sampleFront` (a front spreading through touching samples); the torch's ray fan → `shared/utils/rayFan`; the cluster's row slabs → `shared/utils/blockSlabs`. Fire and ice both call them. In shared, not arena / combat: both were at their file budget and the three only need the grid's samples | loop-plan | Owner asked for "much of the logic as fire" and "the same shape"; ice is the second consumer of all three. Rejected: a copy with a marker (allowed at two, but the owner plans more elements); one merged "elements" feature (two domains with their own rules) |
| D5 | What frozen ground does, and for how long | closed | It behaves like the ice the game has (slippery with ice's friction, blasts don't cut it, fire can't enter it) and thaws by itself after 8 s | loop-refine | clear-winner, derived from "the same system as fire" (a burning piece burns out) and the existing ice rules; told to the owner in chat. Rejected: frozen until the torch thaws it (the arena would fill with unbreakable ground) |
| D6 | Fire and ice | closed | Spreading fire stops at frozen ground. The torch always turns frozen ground back to normal, and burns it afterwards only if it could have burned in the first place. Freezing a burning piece puts it out | loop-refine | Owner, 2026-11-18. The last clause is the agent's reading of "ice puts fire out" from the task. A stopped fire does not return when the ground thaws |
| D7 | Starting values and look | closed | 40 units/s, frozen 8 s, 3 s of charge, beam 180 units and ±3°, push 300, torch thaw radius 8; frozen ground in the `frost` swatch with a lip and gloss, the beam pale with a white core; accent glacier `#6fc8e8`, tube `emitter` | loop-plan | agent-pick; the owner tunes and judges the look on the preview (no look options page was shown for the ray itself) |

## Log

- 2026-11-18 — D1 asked (options page https://claude.ai/artifact/UZNxUhkw7VSVGWjPKpwUfo, version 1); owner answered in chat with his own concept (D1, D3, D6)
- 2026-11-18 — D2, D5 closed (clear-winner); D4, D7 closed in the plan
