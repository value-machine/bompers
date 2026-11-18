# Decisions — ice-frozen-blobs

Job: `temp_job_ice-frozen-blobs`
Updated: 2026-11-18

Task (backlog, via the orchestrator): Ice lap 2, frozen blobs. What the freeze ray does to blobs, with counterplay through crouch, dive / headbutt and jump, its interaction with fire on blobs, its look, and how frozen ground under a blob interacts with it.

## Closed

| id | topic | status | choice | source | notes |
|----|-------|--------|--------|--------|-------|
| D1 | What the freeze ray does to a blob | closed | B "Ice block": frozen solid 2.5 s, no control, a puck anyone can shove; 3 jump presses crack it open; a dive shatters it as a normal hit; a crouching blob takes twice as long to freeze; no damage. Shared rules: 0.5 s in the ray first; ice and fire cancel on a blob; frozen ground alone never freezes a blob | owner, 2026-11-18, via the orchestrator, options page https://claude.ai/artifact/JL35sUTupqc3HhsGZykgu9 | Not taken: A Cold feet (recommended: control kept, no grip), C Brittle shell (next hit +1 chunk). The pick takes control away, unlike the burning blob (fire-burn D3) |
| D2 | Sounds | closed | Placeholders: freeze, crack and shatter all play `clink` (crack softer); a melt plays fire's douse cue. The moments are listed in GAME_JUICE | orchestrator, 2026-11-18 | The element-sounds thread adds the real sounds in a later round |
| D3 | Chill | closed | Beam time adds up per blob (half speed while crouching) and runs back down at the same speed out of the beam, so a sweep does nothing. A diving blob (wind-up, travel) and a spawn-protected blob gather none. 0.5 s after a block ends the blob can't gather chill | loop-refine | clear-winner: mirrors fire's grace (fire-burn D8); spawn protection means "nothing happens to me". Rejected: chill kept forever (two sweeps minutes apart would freeze) |
| D4 | How the block slides | closed | The existing controller modifiers: `steerScale` 0.15 (braking at 15 %, times the ground's own grip, so frozen ground carries it about ten times further) and `jumpLocked`; the roll ends when a blob freezes. Written after the dive step, which resets the modifiers every step | loop-plan | clear-winner: no player-feature change. Rejected: a new `gripScale` field (same effect, one more modifier); the roll's ball physics (it would bounce and spin, and be steerable). Limit: the block does not start sliding down a slope by itself |
| D5 | What breaks the block | closed | Any `playerHit` on it this step (dive, blast, crush is an elimination) shatters it; the hit itself is untouched. The third jump press, the timer and fire end it too. A held jump at the moment of freezing is not a press | loop-refine | "a dive or blast shatters it and lands as a normal hit" (options page) |
| D6 | Fire and ice on a blob | closed | The match cancels them: a blob that burns and is chilled or frozen in the same step is put out (fire's douse, with its 0.5 s grace) and its ice is gone. So the ray puts a burning blob out before any chill stays, and the torch or burning ground melts a block without lighting the blob for that touch | loop-plan | Neither feature imports the other (as in lap 1). Known: fire's catch pop and cue play for the step the flame touches the block |
| D7 | No control | closed | A frozen blob's inputs are emptied for the controller, combat and the dive (move, aim, jump, fire, crouch), so it cannot shoot or dive; pause still works | loop-refine | "no control" (D1) |
| D8 | Look and starting values | closed | The options page's block: a glossy rounded cube in the ice colours around the blob, pinprick pupils, a crack per press, shards when it breaks, steam when it melts; it forms around the blob while the chill builds. `ice.blob`: freeze 0.5 s, crouch × 0.5, frozen 2.5 s, 3 cracks, grip 0.15, grace 0.5 s, moments 0.5 s | owner pick (D1) + agent-pick for the numbers | The owner tunes on the preview |

## Open

| id | topic | status | options briefly | blocked phase |
|----|-------|--------|-----------------|---------------|

## Log

- 2026-11-18 — D1 asked on the options page (version 1), reported to the orchestrator. No game code before the pick.
- 2026-11-18 — owner picked B via the orchestrator; D2 from the orchestrator; D3–D8 closed (clear-winner / plan).
