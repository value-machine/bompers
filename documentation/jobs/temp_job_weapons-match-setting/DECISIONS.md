# Decisions — weapons-match-setting

Job: `temp_job_weapons-match-setting`
Updated: 2026-11-18

## Closed

| id | topic | choice | notes |
|----|-------|--------|-------|
| D1 | Precedence of a level's weapons | The level's `data-weapons` wins over the lobby, like `data-match-duration` (lobby D2); the lobby shows a note. | Derived from level-direction D6 ("works like the level's match duration"). |
| D2 | Format of the level default | Root attribute `data-weapons`: space-separated weapon IDs, or `none`. Left out (or `auto`) = the lobby's choice. Unknown or non-weapon IDs are left out with W4; if none remain, the attribute is ignored with W4. | Alternatives: one ID only (can't say "rockets and homing"); a child element (heavier than a root setting). Forgiving per level-direction D3. |
| D3 | Which weapon a crate holds | The next weapon of the match's list, by one counter over all crates, at the next drop point round-robin. Empty list: no weapon crates. | Keeps the homing-missiles D4 alternation, now global instead of per drop. |
| D4 | Leftover `data-items` | No special case: it is an unknown `data-*` on a drop and gets W10 like any other. | Compatibility waived (level-direction D6). |

## Open

| id | topic | options | notes |
|----|-------|---------|-------|
| D5 | Lobby control look | A stepper like Match length (recommended) · B toggle chips · C stepper with icons | Options page: https://claude.ai/artifact/HffTAJfPaBbKyp8dqfWTKg |

## Log

- 2026-11-18 — brief drafted; options page published; D1–D4 derived.
