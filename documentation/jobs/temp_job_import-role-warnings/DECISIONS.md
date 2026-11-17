# Decisions — import-role-warnings

Job: `temp_job_import-role-warnings`
Updated: 2026-11-16

## Closed

| id | topic | status | choice | source | notes |
|----|-------|--------|--------|--------|-------|
| D1 | Warning code | closed | New W11 "item on the wrong role" | loop-refine | clear-winner — W4 means "not in the catalog"; a known ID on the wrong role is a different fix for the author. Additive per LEVEL_FORMAT § 10 (no version bump). Rejected: widening W4 |
| D2 | Fallback | closed | Same as W4: drop leaves the ID out (default drop items when none remain), collectible uses the default collectible | loop-refine | clear-winner — task: warnings, not errors; the level stays playable. Rejected: keep the item and only warn (engine would run e.g. a weapon as a floating collectible) |
| D3 | Role SSOT | closed | `ItemEntry.use` in the content catalog, read through one `itemUseOf(id)` (gives the actual role for the warning text); preview reads the same field from the generated `catalog.json` | loop-refine | Task: catalog is the single source |

## Open

| id | topic | status | options briefly | blocked phase |
|----|-------|--------|-----------------|---------------|

## Log

- 2026-11-16 — D1–D3 via loop-refine (clear-winner)
- 2026-11-16 — loop-build: main's LEVEL_PROMPT.md was stale (cell size 8 → 4 from #45); `pnpm level-kit:sync` refreshed it in this lap
