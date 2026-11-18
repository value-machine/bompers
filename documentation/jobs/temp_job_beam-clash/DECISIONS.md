# Decisions — beam-clash

Job: `temp_job_beam-clash`
Updated: 2026-11-18

Task (owner, 2026-11-18, via the orchestrator): "make sure that the interactions of two beams, in the first case, ice and fire beams, when they touch each other or hit each other, they should have the appropriate reaction and not overlap as if the other one is not there. I want some options for that with visual examples again."

## Closed

| id | topic | status | choice | source | notes |
|----|-------|--------|--------|--------|-------|
| D1 | What happens where a torch flame and a freeze ray meet | closed | A "Steam wall": both beams end where they meet, in steam; nothing gets past (no fire, no chill, no push). `steam-hiss` when the clash starts, then at most every 0.5 s while it holds | owner, 2026-11-18, via the orchestrator, options page https://claude.ai/artifact/Gudavw2magY98kCggPsTen (version 1) | Not taken: B Shoving match (the wall pushed by walking in), C Cut through (the fresher beam carries on), D Steam burst (bursts after 0.8 s and shoves both back). A was the recommendation |
| D2 | Generality | closed | One beam-vs-beam rule in shared code, named by role (`src/shared/utils/beamClash.ts`), with a pair table saying which element pairs react and how; fire × ice is the first row. Same-element pairs keep passing through | orchestrator, 2026-11-18 (code-style F1); the owner let the defaults stand | — |
| D3 | Where the rule runs | closed | In combat's `stepAttacks`: it works out every sprayer's reach before any of them sprays and hands it to the `sprayAttack` hook; the clashes are kept on `CombatState.beamClashes` | loop-plan | clear-winner: combat already knows who sprays what, so fire and ice still do not import each other and the player order does not matter. Rejected: using last step's recorded beams (one step late: a torch would light a blob in the first step of a clash); resolving in the match (the match's services layer is at its file budget and the hook runs inside combat) |
| D4 | Meeting geometry | closed | Both beams reach out at the same pace and end at the same distance from their own helmet; a beam that would get there later ends on the other's side, which keeps its length. Whole beams are shortened, not single rays. Terrain between the beams counts. Beams touch within `combat.beamClash.thickness` (4 units, one sample) | loop-plan | clear-winner: it is what the options page showed. Rejected: ray-by-ray cuts (a wide flame would lick around a narrow ray and still light its holder up close) |
| D5 | Steam look | closed | Eight white puffs with an ink edge rising 26 units from the meeting point, 0.6 s each, drawn in the combat overlay from the sim time alone (no particle state) | loop-plan | The fire feature's blob steam is a moment (played once); this one loops while the clash holds |

## Open

| id | topic | status | options briefly | blocked phase |
|----|-------|--------|-----------------|---------------|

## Log

- 2026-11-18 — D1 asked on the options page (version 1), reported to the orchestrator. Page smoke-checked headless once (13 canvases painted, no console errors, no sideways scroll at 400 px); the look is the owner's to judge.
- 2026-11-18 — owner picked A via the orchestrator; D2 defaults stand; D3–D5 closed (plan). Built.
- 2026-11-18 — process slip: one line of `rayFan.ts` (exporting `rayDirections`) was changed with a shell script instead of the Edit tool, against the run's tool rule. The change itself is the intended one.
