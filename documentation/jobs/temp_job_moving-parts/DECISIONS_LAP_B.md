# Decisions — moving-parts, lap B (moving parts move in the game)

Job: `temp_job_moving-parts` · lap B · Updated: 2026-11-17
Lap A ledger: `DECISIONS.md` (D1–D16; D11–D16 are the lap B runtime contract, D13 crush = eliminated, credit to the last hitter).

## Closed

| id | topic | status | choice | source | notes |
|----|-------|--------|--------|--------|-------|
| B1 | Motion cue | closed | 2B: no cue. Parts look like any terrain slab until they move: no track, no end ticks, no rivet | owner via orchestrator ("no"; replaces an earlier 2A) | |
| B2 | Sound | closed | Parts are silent by default. A crush plays `land` then `elimination` (3A). The format gets optional per-part sound attributes the author declares: one for movement (e.g. a woosh while travelling or swinging) and one for each end of the path or swing. Values are `data-sound` catalog IDs; prompt, catalog and validator document and check them. | owner via orchestrator (owner's words: "silent, but flexible … the level editor should declare") | No new sound files this lap; a woosh is a later task with a listening page first |
| B4 | Leaving a part | closed | A body that leaves a part (jump, dive, walking off) keeps the part's velocity once, capped at the ride speed (340); crates keep the vertical part only | orchestrator, owner may ask for uncapped | built in lap B-2 (prep commit) |
| B3 | Crush look | closed | R2A: the blob flattens into a pancake against the part (past the squash band, owner-approved) and holds 0.15 s. It then turns straight into knockout goo splats on both faces: the splats on the part ride along, the ones on the wall stay put. Same splats as a normal kill, no separate pop. | owner (round 1 correction); round 2: owner had no preference, recommended taken | Crush render waits for #50 (`feat/elimination-goo`) to merge |
| B5 | Squeeze rule | closed | A gap narrower than the blob is survivable: the blob squashes to fit (past the band, toward the pancake look), can still move and jump out, and springs back when the gap opens. Only a gap under 20% of the body width (`player.crushGapFraction`) crushes | owner (change round on #64: "it should just squish and then unsquish again"); lethal fraction 0.2 by the orchestrator | tunable |

## Open

| id | topic | status | options briefly | blocked phase |
|----|-------|--------|-----------------|---------------|

## Log

- 2026-11-17 — B1, B2 closed via the owner (options page round 1, relayed by the orchestrator). 1A was replaced by the owner's pancake → splats; round 2 demo published on the same page.
- 2026-11-17 — B1 changed to 2B (owner). B3 closed: R2A (owner: no preference, recommended taken).
- 2026-11-18 — Lap B-2 built: crush (B3 R2A) and author-declared part sounds (B2), plus velocity on leaving (B4); merged main after #50.
- 2026-11-18 — B5 built: survivable squeeze (owner change round on #64); crusher test level gains a squeezer station.
