# Decisions — material-system

Job: `temp_job_material-system`
Updated: 2026-11-16

## Closed

| id | topic | status | choice | source | notes |
|----|-------|--------|--------|--------|-------|
| D2 | Old level files | closed | Bump the format version; no v1→v2 migration; kit path follows the version | loop-refine | Owner waived backwards compatibility; shipped levels are rewritten |
| D3 | Shared structure | closed | Every material draws as the rounded slab with top lip (plum-ground structure); breakable slabs are clipped to remaining cells | loop-refine | Owner § 4.1; replaces the honey-tile look and the DESIGN_LANGUAGE § 2 hue rule |
| D1 | Colour vs behaviour | closed | A — decouple: `data-material` (stone / earth / cardboard / ice) sets behaviour; optional `data-color` picks a named swatch (no free hex); behaviour shown by surface pattern (breakable: seam grid + pips + cracks; ice: gloss streaks + white rim; solid: smooth with lip) | owner (via orchestrator) | Replaces DESIGN_LANGUAGE § 2 plum/honey rule |
| D4 | Ice physics | closed | Material `friction` scales grounded accel/decel of the blob | loop-refine | Field exists in the catalog, unused until now |

## Open

| id | topic | status | options briefly | blocked phase |
|----|-------|--------|-----------------|---------------|

| D5 | Terrain roles | closed | One role `terrain` replaces `platform` / `destructible`; breakability comes from the material only | loop-plan | Removes the double coding; one line in a prompt |
| D6 | Retired `dirt` ID | closed | Removed, no alias (format bump, compat waived); `earth` is the new breakable default | loop-plan | Alias rule in LEVEL_FORMAT § 6 applies within a format version |
| D7 | Where colours live | closed | Catalog kind `color` (IDs + labels, default per material); RGB in `gamePalette.terrainSwatches`; kit catalog.json carries the hex for the preview | loop-plan | Palette stays the one home of game colours |
| D8 | Breakable rendering | closed | Breakable pieces draw the same slab (ink, fill, lip, seams) clipped by a cell mask; ink clipped by a mask grown by the outline width; cracks stay per chunk | loop-plan | Alternatives: per-cell rounded tiles (loses slab silhouette), polygon cut-outs (heavy geometry) |
| D9 | Overlaps | closed | An unbreakable material wins over a breakable one; between equals the later piece sets material and colour | loop-plan | Same meaning as v1's platform-wins rule |
| D10 | Kit path | closed | Kit moves to `/level-kit/v2/`; v1 folder removed; `projectStructure.config.cjs` whitelist entry renamed v1 → v2 (owner consent for the protected file, relayed by the orchestrator) | loop-plan + owner | Follows the version (LEVEL_FORMAT § 8), compat waived |

## Log

- 2026-11-16 — D1 closed via owner answer (A), relayed by the orchestrator
- 2026-11-16 — D5–D10 closed via loop-plan (clear-winner)
- 2026-11-16 — D2–D4 closed via loop-refine (clear-winner)
- 2026-11-16 — Coordination note (orchestrator, open-map-edges thread): LEVEL_FORMAT bounds row will say only the bottom edge eliminates; sides and top are open. Keep that meaning if the bounds section is rewritten; rebase onto main before ship.
