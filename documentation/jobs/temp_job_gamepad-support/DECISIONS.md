# Decisions — gamepad-support

Job: `temp_job_gamepad-support`
Updated: 2026-11-16

## Closed

| id | topic | status | choice | source | notes |
|----|-------|--------|--------|--------|-------|
| D1 | Stick deadzone shape | closed | move: axial on x, rescaled; aim: radial, rescaled, clamped to 1 (both 0.25) | loop-refine | clear-winner over square (current: 0→0.25 speed jump, diagonal snap) and pure radial for move (vertical aim would creep sideways) |
| D2 | Pause press home | closed | `PlayerInput.pause` per slot (held), pad Start + Escape on both keyboard halves | loop-refine | clear-winner over a `MenuInput` field: pause is per player in a match, menus are per device; the sim ignores it |
| D3 | Pad disconnect mid-round | closed | slot input goes empty: blob stays in the round and idles; same pad index back → resumes | loop-refine | clear-winner: no new UI or rule; removal / auto-pause belongs to the pause-menu lap |
| D4 | Pad identity | closed | keep "Pad N" = browser gamepad index 0–3 | loop-refine | clear-winner: matches the lobby (lobby D3/D4); index reshuffles on replug are browser behaviour, noted for the owner test |

## Open

| id | topic | status | options briefly | blocked phase |
|----|-------|--------|-----------------|---------------|

## Log

- 2026-11-16 — D1–D4 closed via loop-refine (clear-winner)
