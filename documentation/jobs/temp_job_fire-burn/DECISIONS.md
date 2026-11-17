# Decisions — fire-burn

Job: `temp_job_fire-burn`
Updated: 2026-11-17

## Closed

| id | topic | status | choice | source | notes |
|----|-------|--------|--------|--------|-------|
| D1 | Burning blob look | closed | Variant 2's look (pinprick pupils, flying sweat, its flame / steam / smoke effects) with variant 1's drawn-only hops | owner (options page round 2, via orchestrator: "2, but with the drawn hops of 1; the look effects of 2 are better") | Round 1: owner chose panic hops but full control kept, flee with no input, panic eyes |
| D2 | Flee with no input | closed | Full run speed away from where the fire came from; it runs off ledges | owner ("Run off the ledge.") | Applied as a move input, so the controller's ground and air rules all hold |
| D3 | Control while burning | closed | Unchanged: move and jump as normal; hops are drawn only | owner (round 1 feedback) | A drawn hop never changes the body's position |
| D4 | Bump | closed | Passes the fire: the rival starts burning (fresh 2 s), the bumper stops | loop-refine (owner D7 "bumping a rival passes the fire on"; round-2 sketch showed the leap) | |
| D5 | Burn damage | closed | 1 chunk through `applyHit` as kind `burn` (front 1, back 1), source `fire`, credited to whoever lit or passed it; crouching does not halve it | loop-refine | Ducking does not stop fire; owner D7 says −1 chunk |
| D6 | Catching | closed | A blob catches from any burning terrain sample within its body radius + one sample (centre to sample centre), or from a torch ray that reaches it; a burning blob is not re-lit (its 2 s keep running) | loop-refine; reach widened from half a sample in build (a standing blob's centre sits about half a sample plus the radius from the sample centres under it) | |
| D8 | Grace after going out | closed | A blob just put out can't catch for 0.5 s (`fire.blob.graceSeconds`) | loop-build | Without it two blobs still touching pass the fire back and forth every step |
| D9 | Stack | closed | Branch `claude/fire-burn` stacked on #53 (`claude/fire-spread`); the PR moves to `main` after #53 lands | loop-build | #53 not merged yet; orchestrator allowed it |
| D7 | Sounds | closed | Placeholders until fire takes exist: catching fire `rocket-fire`, put out by ice `clink`, by a dive the dive's own launch sound, the chunk the existing hit cue | loop-refine (fire-spread D8) | |

## Open

| id | topic | status | options briefly | blocked phase |
|----|-------|--------|-----------------|---------------|

## Log

- 2026-11-17 — D1–D3 owner picks via the burning-blob options page (https://claude.ai/artifact/6AXupe47LVTiADJ9mxYg2s); D4–D7 loop-refine
