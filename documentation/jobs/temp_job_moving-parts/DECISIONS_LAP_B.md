# Decisions — moving-parts, lap B (moving parts move in the game)

Job: `temp_job_moving-parts` · lap B · Updated: 2026-11-17
Lap A ledger: `DECISIONS.md` (D1–D16; D11–D16 are the lap B runtime contract, D13 crush = eliminated, credit to the last hitter).

## Closed

| id | topic | status | choice | source | notes |
|----|-------|--------|--------|--------|-------|
| B1 | Motion cue | closed | 2A: a faint dashed ink track with end ticks behind slide/path parts, and a rivet at the pivot of spin/swing parts | owner, options page round 1 | |
| B2 | Sound | closed | Parts are silent by default. A crush plays `land` then `elimination` (3A). The format gets optional per-part sound attributes the author declares: one for movement (e.g. a woosh while travelling or swinging) and one for each end of the path or swing. Values are `data-sound` catalog IDs; prompt, catalog and validator document and check them. | owner via orchestrator (owner's words: "silent, but flexible … the level editor should declare") | No new sound files this lap; a woosh is a later task with a listening page first |
| B3 | Crush look | open → round 2 | Pancake hold against the part, then straight to knockout goo splats at the pancake, stuck on the object (same splats as a normal kill, no separate pop). Flattening past the squash band is owner-approved. | owner via orchestrator | Round 2 picks: R2A short hold, splats on both faces / R2B long hold, splats ride the part / R2C short hold, splats stay on the wall. Depends on the knockout goo (#50, `feat/elimination-goo`) |

## Open

| id | topic | status | options briefly | blocked phase |
|----|-------|--------|-----------------|---------------|
| B3 | Crush look, round 2 | open | R2A (recommended) / R2B / R2C | crush render + juice only; collision is planned meanwhile |

## Log

- 2026-11-17 — B1, B2 closed via the owner (options page round 1, relayed by the orchestrator). 1A was replaced by the owner's pancake → splats; round 2 demo published on the same page.
