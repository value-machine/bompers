# Decisions — mover-materials

Job: `temp_job_mover-materials`
Updated: 2026-11-18

Task (owner, 2026-11-18, via the orchestrator): "the beam weapons, so or the spray weapons, flamethrower and ice freeze ray, they should also be stopped by moving platforms, and if not yet the case, moving platforms should be able to be any material, so they should also be able to catch fire and freeze if they belong to a material that takes that. For that solution, I want to look at different approaches of solving it, each one deeper than the last, because we want to build a very extensible and flexible system."

## Closed

None.

## Open

| id | topic | status | options briefly | blocked phase |
|----|-------|--------|-----------------|---------------|
| D1 | How deep moving parts join the element system | open | 1 Beams stop on parts (S) · 2 Parts take states: fire and ice state per part, wired per feature (M + M) · 3 One world of bodies: terrain and parts in one list, every element system written once, reactions from a material × element and an element × element table (about five laps of S–M; recommended, starting with 1) · 4 Everything solid is a body: 3 plus loose falling chunks, crates and ice blocks as bodies (3 first, then its own design round). Options page https://claude.ai/artifact/JZL9rcbHbyeGA3LCNE8JzC (version 1) | everything: no game code before the pick |

## Notes for the pick

- Conflict with a recorded decision: LEVEL_FORMAT § 11 and W13 (moving-parts D-rows) say moving parts never break and never burn. The owner's request reverses the "never burn" half from approach 2 up; whether blasts may break parts is a later choice (below).
- Level direction (level-direction D1, D4, D7): every approach keeps the level as layout plus match settings. From approach 2 up a part's material matters, so the prompt's moving-parts line changes; nothing else an author can place or set is added. Approach 4 fits only while behaviours stay in the catalog.
- Beam clash (PR #75) edits the same ray fan. The two changes are compatible (what a ray hits; where it is cut) and should land one after the other.
- Choices that come up inside the laps, to ask then: may fire cross between a part and the ground it touches; what a fully burnt part leaves behind; may blasts break parts.

## Log

- 2026-11-18 — D1 asked on the options page (version 1), reported to the orchestrator. Page smoke-checked headless once at 400 px: no console errors, no sideways scroll, four diagrams built, the scene's sampled pixels change per depth (shelf burns at depth 3, a loose piece lands at depth 4, the lift freezes at depth 2). Not verified: the look, which is the owner's to judge.
