# Decisions — material-system

Job: `temp_job_material-system`
Updated: 2026-11-16

## Closed

| id | topic | status | choice | source | notes |
|----|-------|--------|--------|--------|-------|
| D2 | Old level files | closed | Bump the format version; no v1→v2 migration; kit path follows the version | loop-refine | Owner waived backwards compatibility; shipped levels are rewritten |
| D3 | Shared structure | closed | Every material draws as the rounded slab with top lip (plum-ground structure); breakable slabs are clipped to remaining cells | loop-refine | Owner § 4.1; replaces the honey-tile look and the DESIGN_LANGUAGE § 2 hue rule |
| D4 | Ice physics | closed | Material `friction` scales grounded accel/decel of the blob | loop-refine | Field exists in the catalog, unused until now |

## Open

| id | topic | status | options briefly | blocked phase |
|----|-------|--------|-----------------|---------------|
| D1 | Colour vs behaviour | open | A decouple (material + named colour swatch, non-colour cues) / B coupled colour variants per material / C colour free within a per-material family | plan |

## Log

- 2026-11-16 — D2–D4 closed via loop-refine (clear-winner)
- 2026-11-16 — Coordination note (orchestrator, open-map-edges thread): LEVEL_FORMAT bounds row will say only the bottom edge eliminates; sides and top are open. Keep that meaning if the bounds section is rewritten; rebase onto main before ship.
