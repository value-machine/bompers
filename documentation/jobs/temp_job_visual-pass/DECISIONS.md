# Decisions — visual-pass

Job: `temp_job_visual-pass`
Updated: 2026-11-14

## Closed

| id  | topic                   | status | choice                                                                                                                                                                                          | source      | notes                                                                                                                                                                                        |
| --- | ----------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Mockup → game scale     | closed | Mockup sizes and the § 3 world widths are at the reference R = 30; the game blob has R ≈ 13.2 (height 28), so they scale by `DESIGN_SCALE` = 0.44; screen clamps (minPx / maxPx) stay in pixels | loop-refine | clear-winner: keeps mockup proportions (line ≈ 12 % of R); alternatives: spec numbers literally (line 27 % of R, heavy)                                                                      |
| D2  | Solid slab geometry     | closed | Draw indestructible terrain from the level's piece shapes (rect → round rect r 14 × scale, polygon, circle), not from the cell grid                                                             | loop-plan   | clear-winner: solid never changes, so a static vector slab gives the spec's "one continuous rounded slab"; grid steps would show 8-unit stairs. Edge differs from collision by ≤ half a cell |
| D3  | Destructible tile size  | closed | Visual tile = 2 × 2 sim cells (16 units at cell 8); intact tiles draw as rounded tiles with grid line + pip, partly blasted tiles draw their remaining cells stepped                            | loop-plan   | clear-winner: start-arena plateaus are 16 tall, so a 3-cell tile would leave them gridless; 16 ≈ mockup tile 28 × D1 scale 12                                                                |
| D4  | Width changes with zoom | closed | Outline world width is quantised in 10 % steps; static layers redraw only when the step changes                                                                                                 | loop-plan   | clear-winner: per-frame redraw of every Graphics is the expensive path                                                                                                                       |
| D5  | Font wait               | closed | Session start awaits `document.fonts.load("700 20px Fredoka")` up to 1.5 s, then starts with the fallback face                                                                                  | loop-plan   | clear-winner: spec § 7; the timeout keeps offline play working                                                                                                                               |
| D7  | Blob silhouette         | closed | Two trees per blob with identical transforms: ink (parts stroked at 2× width) under fill; blink fades only the fill                                                                             | loop-build  | clear-winner: spec § 3 "two passes, no filters" while each part keeps its own squash / foot / tumble transform; a group alpha would need a filter                                            |
| D8  | Blob size and tube      | closed | `r = height / 2.3` (body top = collision height, mockup proportions); rocket tube moves from combat into the player silhouette (`armedIds`)                                                     | loop-build  | clear-winner: the old round body used 2.12; the egg is 1.94 R tall plus a 9-unit foot gap. Tube in combat could not share the silhouette                                                     |
| D6  | Cracks                  | closed | A tile cracks when one of its cells or a neighbour cell was filled at level load and is empty now                                                                                               | loop-plan   | clear-winner: renderer keeps a snapshot of the initial cells; the sim stays untouched                                                                                                        |

## Open

| id  | topic | status | options briefly | blocked phase |
| --- | ----- | ------ | --------------- | ------------- |

## Log

- 2026-11-14 — D1–D6 closed (clear-winner)
- 2026-11-14 — #12 merged; phase B folded into the same PR (orchestrator); D7–D8 closed
