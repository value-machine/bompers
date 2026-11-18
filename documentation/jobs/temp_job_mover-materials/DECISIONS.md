# Decisions — mover-materials

Job: `temp_job_mover-materials`
Updated: 2026-11-18

Task (owner, 2026-11-18, via the orchestrator): "the beam weapons, so or the spray weapons, flamethrower and ice freeze ray, they should also be stopped by moving platforms, and if not yet the case, moving platforms should be able to be any material, so they should also be able to catch fire and freeze if they belong to a material that takes that. For that solution, I want to look at different approaches of solving it, each one deeper than the last, because we want to build a very extensible and flexible system."

## Closed

| id | topic | status | choice | source | notes |
|----|-------|--------|--------|--------|-------|
| D1 | How deep moving parts join the element system | closed | One world of bodies (the page's approach 3), starting with the beam fix: terrain and every part in one list of bodies, each element system written once against it, reactions from a material × element table and an element × element table | owner, 2026-11-18, question tool via the orchestrator | Over beams-stop only, parts-take-states, and everything-is-a-body. Options page https://claude.ai/artifact/JZL9rcbHbyeGA3LCNE8JzC (version 1) |
| D2 | "Moving parts never burn" (LEVEL_FORMAT § 11, W13; level prompt) | closed | Reversed: a part takes its material's fire and ice. Applied in lap 2 (W13, § 11 and the prompt's moving-parts line change there). The "never break" half stays until the owner decides on blasts (lap 4) | owner, 2026-11-18, confirmed with D1 via the orchestrator | Supersedes the moving-parts lap's rule for burning |
| D3 | Lap cut | closed | L1 (S) beams stop on parts · L2 (M) the body list; fire and ice state per body; parts drawn cut and overlaid; grip per sample; blobs catch from burning parts; W13 + prompt line · L3 (M) reactions as data in the catalog, beam clash's pair table moves in · L4 (S–M) craters on parts · L5 (S–M) fire crosses where bodies touch | orchestrator, 2026-11-18 | L2–L5 go to the backlog by the orchestrator. Asked when their laps come up: fire crossing (L5), what a burnt-out part leaves (L2), blasts breaking parts (L4) |
| D4 | How the shared ray fan sees parts | closed | The fan takes a list of sample fields, each with an optional world-to-local map, and reports which one a ray stopped on; the arena builds the list (`terrainBodies`) | loop-plan, clear winner | `shared/utils` may not import a feature, so a callback into the arena's solid query would have to be passed in anyway; a list also names the body, which lap 2 needs. Edits to `rayFan.ts` wait for PR #75 |

## Open

None.

## Notes from the pick

- Conflict with a recorded decision: LEVEL_FORMAT § 11 and W13 (moving-parts D-rows) say moving parts never break and never burn. The owner's request reverses the "never burn" half from approach 2 up; whether blasts may break parts is a later choice (below).
- Level direction (level-direction D1, D4, D7): every approach keeps the level as layout plus match settings. From approach 2 up a part's material matters, so the prompt's moving-parts line changes; nothing else an author can place or set is added. Approach 4 fits only while behaviours stay in the catalog.
- Beam clash (PR #75) edits the same ray fan. The two changes are compatible (what a ray hits; where it is cut) and should land one after the other.
- Choices that come up inside the laps, to ask then: may fire cross between a part and the ground it touches; what a fully burnt part leaves behind; may blasts break parts.

## Log

- 2026-11-18 — Lap 1 built after #75 merged. The beam clash casts its own fans, so it takes the same field list (combat edge added to the brief). The type is `PosedField` in `shared/types`, not a ray-only name, since lap 2 reuses it. Pair table still keyed per beam; re-keying by element ID moves to lap 3 (orchestrator).
- 2026-11-18 — D1 picked (approach 3), D2 confirmed, lap cut accepted; lap 1 planned in BRIEF.md § Plan. Build waits for "#75 merged".
- 2026-11-18 — D1 asked on the options page (version 1), reported to the orchestrator. Page smoke-checked headless once at 400 px: no console errors, no sideways scroll, four diagrams built, the scene's sampled pixels change per depth (shelf burns at depth 3, a loose piece lands at depth 4, the lift freezes at depth 2). Not verified: the look, which is the owner's to judge.
