# Decisions — game-juice-system

Job: `temp_job_game-juice-system`
Updated: 2026-11-16

## Closed

| id | topic | status | choice | source | notes |
|----|-------|--------|--------|--------|-------|
| D1 | Where the SSOT lives | closed | scale in `src/shared/config/gameJuice.ts`; values stay in their homes and read / conform to it | loop-refine | Alternatives: move every juice constant into one module (conflicts with the feet / jump / music threads, retunes risk), doc-only (not checkable). Clear winner. |
| D2 | Discrete beat scale vs timing windows | closed | windows per role (seconds range) | loop-refine | A discrete scale would force retuning built values (jump squash 0.15, pop 0.22); windows keep them and still bound new ones. |
| D3 | Squash area band | closed | `sx·sy` in [0.93, 1.01] | loop-refine | DESIGN_LANGUAGE § 6 said 0.94–1.0, but its own land preset (1.25 × 0.75 = 0.9375) and jump (0.85 × 1.18 = 1.003) sit outside; band set to the built presets, no retune. |
| D4 | Agent guidance shape | closed | spec skill `spec-apply-game-juice` + path-scoped rule pointer | loop-refine | Rule auto-loads when game render / sound / effects / tunables files are touched; skill holds the procedure (loop-plan picks juice, loop-check verifies). |
| D5 | Protected-file consent | closed | owner yes: new skill `spec-apply-game-juice` + catalog row, new rule `.claude/rules/game-juice.md` | owner (via orchestrator) | 2026-11-16 |

## Log

- 2026-11-16 — D1–D4 closed via loop-refine (clear-winner)
