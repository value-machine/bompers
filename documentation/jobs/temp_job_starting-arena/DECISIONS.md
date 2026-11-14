# Decisions — starting-arena

Job: `temp_job_starting-arena`
Updated: 2026-11-14

## Closed

| id  | topic               | status | choice                                                                                                                                                  | source      | notes                                                                                                                                               |
| --- | ------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Scale reference     | closed | engine tunables (player 28 × 28, jump ≈ 153, cell 8) over the design-language mockup (R 34, cell 28)                                                    | loop-refine | clear-winner: the engine is what plays the file; mockup sizes are art direction. Phase 2 re-tunes if the movement lap changes them.                 |
| D2  | Plateau step height | closed | 112 units per tier (≈ 73 % of jump height)                                                                                                              | loop-refine | clear-winner: reachable from the side with margin; the top tier (224 above main) needs the middle tier or a rocket jump, which makes vertical play. |
| D3  | Indestructible core | closed | stone core under the main surface spanning every spawn's x, plus a stone heart on the top plateau; all crusts, edges, keel and middle plateaus are dirt | loop-refine | clear-winner per task: map stays playable after any amount of blasting; spawns never end over a void.                                               |
| D4  | Spawn point meaning | closed | circle centre 24 units above the surface (AUTHORING.md rule 7)                                                                                          | loop-refine | clear-winner: the format's authoring rule; the importer decides feet-point conversion.                                                              |

## Open

| id  | topic | status | options briefly | blocked phase |
| --- | ----- | ------ | --------------- | ------------- |

## Log

- 2026-11-14 — D1–D4 closed via loop-refine (clear-winner)
