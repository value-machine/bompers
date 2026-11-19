# Decisions — level-objects

Job: `temp_job_level-objects`
Updated: 2026-11-19

## Closed

| id | topic | status | choice | source | notes |
|----|-------|--------|--------|--------|-------|
| D1 | Tree families in lap 1 | closed | All five: oak, pine, snowy pine, palm, dead tree | loop-refine | Owner, 2026-11-19, options page (relayed by the orchestrator) |
| D2 | Collision | closed | Solid like terrain: parts compile to terrain pieces | loop-refine | Owner, 2026-11-19. Canopies are platforms, rockets crater trees, leaves burn away; no new system |
| D3 | Size in the level file | closed | A box: `<rect data-role="object">` x, y, width, height; the object stands on the box's bottom centre and fills its height; width is clamped to the variant's aspect range | loop-refine | Owner, 2026-11-19 |
| D4 | Trunk look | closed | Existing materials + one new colour `bark` (`#7a5233`, lip `#9a6e48`, seam `#553620`) | loop-refine | Owner, 2026-11-19. Living trunks earth (scorches, craters), leaves cardboard (burn), snow caps ice, dead tree all cardboard |
| D4a | Snow caps are ice | closed | Kept: caps are unbreakable and needles touching them never catch | loop-plan | Plan review A1; the owner picked "Snow cap: ice, frost colour (fire can't catch next to it)" on the options page. Stop 2 test point: rockets don't crater the caps |
| D5 | System shape | closed | Recipe registry (an owner-approved exception to code-style's "no registries until a second consumer") → terrain pieces + `LevelObject` record with `terrainIndices` (lap 2 physics seam), registry generates catalog.json + prompt section, `src/shared/utils/seededRandom.ts`, feature `src/features/level-objects/` | loop-refine | Owner approved the design as proposed, 2026-11-19 |
| D6 | Paint order | closed | An object's pieces sit in document order among the terrain shapes (later paints over earlier), like any terrain shape; an object inside `<g data-motion>` joins that part | loop-plan | clear-winner: one rule for authors ("later shapes paint over earlier ones"), and movers find the pieces through the same element list with no new code |
| D7 | Warnings | closed | W22: object with a missing or unknown `data-kind` → skipped. W23: object corrected (unknown variant → the kind's default, height or width clamped, `data-seed` not a whole number → the default seed) | loop-plan | clear-winner: the importer's one-code-per-rule pattern (LEVEL_FORMAT § 7); a misspelled kind must not silently become a tree |
| D8 | Default seed | closed | FNV-1a hash of `<level id>#<element id, else object ordinal>`; `data-seed` overrides (plan review A5) | loop-plan | clear-winner: the same file always looks the same, two trees in it differ, and editing one tree's box doesn't reshuffle the others |
| D9 | Thinnest part | closed | Every part is at least 8 units (2 samples) thick | loop-plan | clear-winner: the terrain field drops features thinner than a sample (no outline, no collision); twigs and fronds would vanish. Assumes the default cell size 4; a coarser `data-cell-size` can lose twigs (documented, A6) |
| D10 | Juice | closed | No new moment: trees use the terrain's crater, burn, freeze and impact moments of their materials | loop-plan | spec-apply-game-juice: no new element moment, the parts are terrain |
| D11 | Height range | closed | 96–480 units for every tree variant; aspect (width ÷ height): oak 0.6–1.2, pine and snowy pine 0.35–0.75, palm 0.5–1.1, dead 0.5–1.1 | loop-plan | clear-winner: 96 is the smallest height whose thinnest parts still clear D9; 480 is a third of the default 1440-unit-tall world |

## Log

- 2026-11-19 — D1–D5 closed at Stop 1 (owner via the orchestrator; options page "Level Tree Options")
- 2026-11-19 — D6–D11 closed in loop-plan (clear-winner)
