# Decisions — outline-system

Job: `temp_job_outline-system`
Updated: 2026-11-19

## Closed

| id | topic | status | choice | source | notes |
|----|-------|--------|--------|--------|-------|
| D1 | How outlines are built | closed | B: one outline builder, drawn as a line | owner, options page (file `outline-system-options.html`, 2026-11-19) | A (guard the underlay) and C (shader from the distance field) declined. The flash the owner saw was magenta: static terrain ink |
| D2 | Where the line sits | closed | The ring is the terrain's edge itself, stroked at twice the visible width under the fill | loop-plan, clear winner | Keeps the look (visible line outside the edge, same width) and is the convention `outlineWidth` already states ("an ink pass strokes at twice this"). A ring offset outward by half the width would leave hairline gaps between line and fill |
| D3 | Joining the pieces of a ring | closed | By the id of the shared grid edge, not by coordinates | loop-plan, clear winner | Two cells compute the same crossing; ids cannot miss by a rounding error |
| D4 | Cut into laps | closed | 1 terrain and part ink · 2 fills from the field · 3 elements and widths | loop-refine | Each M or smaller; lap 1 alone removes the ink shape the owner saw |
| D5 | Touching shapes read as one | closed | Requirement for lap 2 (one fill and one lip per joined shape) | owner via orchestrator, 2026-11-18 | The outline already treats touching shapes as one; #94 made the field's joins square |

## Log

- 2026-11-19 — D1 closed (asked, owner). D2–D4 closed via loop-refine / loop-plan (clear winner). D5 recorded.
