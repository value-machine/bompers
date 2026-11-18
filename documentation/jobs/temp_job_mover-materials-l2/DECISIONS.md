# Decisions — mover-materials-l2

Job: `temp_job_mover-materials-l2`
Updated: 2026-11-18

Route and owner pick: `documentation/jobs/temp_job_mover-materials/DECISIONS.md` (D1 one world of bodies, D2 parts burn, D3 lap cut).

## Closed

| id | topic | status | choice | source | notes |
|----|-------|--------|--------|--------|-------|
| D1 | What a fully burnt part leaves behind | closed | Nothing, for the rest of the round: the same rule as terrain. Riders fall when their footing goes; the part is back next round | owner, 2026-11-18, question tool via the orchestrator | Over growing back, an unburnable core that keeps moving, and char-only |
| D2 | Lap cut of L2 | closed | L2a (this lap, M): fire per body. L2b (S–M): cold per body (freeze ray on parts, grip per sample, frozen overlay, thaw) | loop-plan size check (skill-loop D44, D51), told to the orchestrator | L2 as first cut covered two sims, two renderers and the format text: over M |
| D3 | Shape of fire's state | closed | `FireState.grounds[]`, one ground fire per body in the arena's body order (0 = static terrain); sprays, blobs and the burn-out beat stay once | loop-plan, clear winner | Keeping the static fire at the top level with a `parts[]` beside it would be a parallel path (workaround shape); one list is the body list of route D1 |
| D4 | Flames on a turning part | closed | A part's fire is drawn in the part's frame, so on a spinning part the flames turn with it | loop-plan, agent pick, flagged for the owner's test | World-up flames on a turning part need the flame top-edge rule in a rotated frame; proposed as a follow-up if the owner dislikes the look |

## Open

None.

## Log

- 2026-11-18 — Lap opened after #77 merged (main 717799c). D1 sent to the orchestrator.
- 2026-11-18 — Plan review done (one merged review): two must-fixes applied (A1, A2), two advisories promoted (A3, A4), one waived (W1). Built phases 1–4 with D1 as option 1. The fire test level in the kit got a cardboard lift and a cardboard spinner so the owner can try it.
- 2026-11-18 — D1 picked by the owner: option 1, as built. No code change.
