# Decisions — ice-element

Job: `temp_job_ice-element`
Updated: 2026-11-18

Task (owner, 2026-11-18, via the orchestrator): do for every element what was done for fire, one by one: a projectile piece and an effect on the map's materials. Ice is next; a further element is decided after it is in.

## Closed

| id | topic | status | choice | source | notes |
|----|-------|--------|--------|--------|-------|
| D2 | Sounds | closed | Not on the options page; placeholders from the existing bank until a listening page | loop-refine | clear-winner: the task says so, and fire did the same (fire-spread D8) |
| D3 | Ice colours | closed | The `frost` swatch and the ice gloss the game already has; no new terrain colour | loop-refine | clear-winner: DESIGN_LANGUAGE § 2 reserves gloss for slippery surfaces, which is what every concept makes. The weapon accent is picked in the plan (not a player hue, not sky `#8fd6ff` or aqua `#5fe0ff`) |

## Open

| id | topic | status | options briefly | blocked phase |
|----|-------|--------|-----------------|---------------|
| D1 | Ice concept | open | A Frost breath (held spray, frost coat on surfaces, slippery blobs, no damage) / B Snowpack (lobbed shot that builds packed ice, feet stuck, 1 chunk) / C Cold snap (freeze rocket, the cold spreads through touching material and turns it to ice for 6 s, blobs freeze into a sliding block; recommended) / a mix | refine |
| D4 | Shared spread mechanism (code-style F1/F2) | open | Decided in the plan once D1 is known. Fire's front (`fireSim.ts`: arrival time per sample, lazy min-heap, 8 neighbours with the corner rule) is the first copy. Under A or C ice is a second consumer of the same front with another cost per material and a reach limit: extract it under a role name (a front that spreads through touching samples) rather than copy it. Under B ice has no front and nothing is extracted | plan |

## Log

- 2026-11-18 — D1 asked (options page https://claude.ai/artifact/UZNxUhkw7VSVGWjPKpwUfo, version 1)
- 2026-11-18 — D2, D3 closed (clear-winner)
