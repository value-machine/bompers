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
| D5 | Lobby control look | **Owner pick: B with a twist** — "toggle per weapon, with the ammo/weapon collect boxes as checkboxes that turn on (normal) and off (disabled visual)". Each toggle is the weapon's in-game crate (#66 look), drawn as SVG from the same proportions (`shared/utils/weaponCrate`). Any combination. | Options page: https://claude.ai/artifact/HffTAJfPaBbKyp8dqfWTKg (A stepper recommended; owner chose B). Relayed by the orchestrator. |
| D6 | Off look, all-on, level default in the lobby | Off = greyscale + 40 % opacity (shape and mouth stay readable). All on reads "All weapons" (= auto; stored as the off set so new weapons start on); all off reads "No weapons". A level with `data-weapons` shows its weapons on the crates, locked, note "Set by the level". | Agent's call per the owner's brief; no true tie. Locked display shows what the round really plays (duration instead keeps its stepper live with a note; for crates a live toggle under an override would show the wrong set). |
| D7 | Pads on the crate row | In-row cursor: left / right move between crates (wrapping), confirm toggles; the menu cursor still moves rows with up / down. Pointer clicks a crate. | Needed by B (options page note). |

## Open

None.

## Log

- 2026-11-18 — brief drafted; options page published; D1–D4 derived.
- 2026-11-18 — owner picked B with crates as toggles (D5); D6, D7 decided by the agent.
