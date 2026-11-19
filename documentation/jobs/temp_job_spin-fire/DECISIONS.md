# Decisions — spin-fire

Job: `temp_job_spin-fire`
Updated: 2026-11-19

## Closed

| id | topic | choice | notes |
|----|-------|--------|-------|
| D1 | How a rolling blob fires | **Owner pick: C, lawn sprinkler** — the shot goes where the spinning barrel points; beams sweep, rockets spray. D (wind-up burst) out; A/B also acceptable "depending on how we can make it work". | Options page (Spin Fire Options), relayed by the orchestrator. |
| D2 | Sweep rate | The weapon heading turns with the roll's spin, capped at `roll.sweepTurnsPerSecond` = 1.25 (≈ 3.75° per 1/120 s step). | Tied 1:1 to the body (spin = speed / 14) a beam jumps 14–34° a step: the 6° freeze ray leaves gaps and the look strobes. Under the cap no beam model change is needed (rays are re-cast every step). |
| D3 | Where shots leave | From the helmet point carried round by the spin (option A falls out of C). | Matches the drawn barrel pivot. |
| D4 | What keeps the stick aim | Dive direction and eyes. | The dive is movement, not a weapon. |
| D5 | Juice | Existing fire / spray moments, light tier; no new sound. | A new sound needs an options page (game-juice rule). |
