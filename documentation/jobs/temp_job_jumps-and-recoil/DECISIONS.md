# Decisions — jumps-and-recoil

Job: `temp_job_jumps-and-recoil`
Updated: 2026-11-16

## Closed

| id  | topic             | status | choice                                                                                  | source      | notes                                                                                                                                                                                                                              |
| --- | ----------------- | ------ | --------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | How to slow jumps | closed | Gravity 2200 → 1400; gravity-coupled vertical speeds × √(1400/2200) ≈ 0.8               | loop-refine | Alternatives: lower gravity only (jumps and rocket jumps get much higher, breaks level heights); per-jump gravity scaling / apex hang (extra mechanism). Same heights, ~25 % more air time: apex 0.48 s → 0.6 s                    |
| D2  | Recoil shape      | closed | Instant velocity change opposite the aim (`combat.rocket.recoil`), on ground and in air | loop-refine | Alternatives: air-only recoil (special case), recoil only on the horizontal axis (loses down-shot hover). Stacks with a rocket jump's blast, so standing rocket jumps get higher (accepted: the owner asked for tactical movement) |
| D3  | Tumble threshold  | closed | Unchanged (800)                                                                         | loop-refine | Blast impulse drops to 1080, so only blasts within ~26 % of the radius tumble (was ~41 %); scaling the threshold too would make glancing dive hits tumble. Tune on preview                                                         |

## Log

- 2026-11-16 — D1–D3 closed via loop-refine (clear-winner)
