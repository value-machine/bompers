# Decisions — beam-clash

Job: `temp_job_beam-clash`
Updated: 2026-11-18

Task (owner, 2026-11-18, via the orchestrator): "make sure that the interactions of two beams, in the first case, ice and fire beams, when they touch each other or hit each other, they should have the appropriate reaction and not overlap as if the other one is not there. I want some options for that with visual examples again."

## Closed

| id | topic | status | choice | source | notes |
|----|-------|--------|--------|--------|-------|
| D2 | Generality | closed | One beam-vs-beam rule in shared code, named by role, with a pair table saying which element pairs react and how; fire × ice is the first row. Same-element pairs keep passing through | orchestrator, 2026-11-18 (code-style F1) | The same-element default is stated on the options page; the owner can change it |

## Open

| id | topic | status | options briefly | blocked phase |
|----|-------|--------|-----------------|---------------|
| D1 | What happens where a torch flame and a freeze ray meet | open | A Steam wall (both end where they meet; recommended) · B Shoving match (A's wall, pushed by walking in; reaching a blob lands the beam) · C Cut through (the fresher beam carries on, the other is cut) · D Steam burst (A's wall, bursts after 0.8 s and shoves both back). Options page https://claude.ai/artifact/Gudavw2magY98kCggPsTen (version 1) | everything: no game code before the pick |

## Log

- 2026-11-18 — D1 asked on the options page (version 1), reported to the orchestrator. Page smoke-checked headless once (13 canvases painted, no console errors, no sideways scroll at 400 px); the look is the owner's to judge.
