# Decisions — mover-materials-l2

Job: `temp_job_mover-materials-l2`
Updated: 2026-11-18

Route and owner pick: `documentation/jobs/temp_job_mover-materials/DECISIONS.md` (D1 one world of bodies, D2 parts burn, D3 lap cut).

## Closed

| id | topic | status | choice | source | notes |
|----|-------|--------|--------|--------|-------|
| D2 | Lap cut of L2 | closed | L2a (this lap, M): fire per body. L2b (S–M): cold per body (freeze ray on parts, grip per sample, frozen overlay, thaw) | loop-plan size check (skill-loop D44, D51), told to the orchestrator | L2 as first cut covered two sims, two renderers and the format text: over M |
| D3 | Shape of fire's state | closed | `FireState.grounds[]`, one ground fire per body in the arena's body order (0 = static terrain); sprays, blobs and the burn-out beat stay once | loop-plan, clear winner | Keeping the static fire at the top level with a `parts[]` beside it would be a parallel path (workaround shape); one list is the body list of route D1 |
| D4 | Flames on a turning part | closed | A part's fire is drawn in the part's frame, so on a spinning part the flames turn with it | loop-plan, agent pick, flagged for the owner's test | World-up flames on a turning part need the flame top-edge rule in a rotated frame; proposed as a follow-up if the owner dislikes the look |

## Open

| id | topic | status | options briefly | blocked phase |
|----|-------|--------|-----------------|---------------|
| D1 | What a fully burnt part leaves behind | open, with the owner via the orchestrator | 1 nothing for the rest of the round (recommended; same rule as terrain) · 2 grows back after some seconds · 3 an unburnable core keeps moving · 4 parts only char and are never removed | phase 4 is built as option 1 and changes if the owner picks otherwise |

## Log

- 2026-11-18 — Lap opened after #77 merged (main 717799c). D1 sent to the orchestrator.
- 2026-11-18 — Plan review done (one merged review): two must-fixes applied (A1, A2), two advisories promoted (A3, A4), one waived (W1). Built phases 1–4 with D1 as option 1. The fire test level in the kit got a cardboard lift and a cardboard spinner so the owner can try it.
