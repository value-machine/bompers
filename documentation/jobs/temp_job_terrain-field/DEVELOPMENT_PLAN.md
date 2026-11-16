# Development plan — terrain-field

Brief: `BRIEF.md` · Decisions: `DECISIONS.md` · Size M · Base: `main` @ 13ee9d1

## Conflict & compliance

- Recorded decisions: blast-power D1 (crater rule) holds as the round case of D4; material-system D9 overlap rule ("unbreakable wins") holds for the slot; LEVEL_FORMAT § 4 "a cell is solid when its centre lies inside a shape" holds (distance > 0 ⇔ inside).
- Placement: `shapeSignedDistance` beside `shapeContains` in `src/shared/utils/shapeGeometry.ts`; crater shapes in `src/shared/utils/craterShape.ts` (arena and combat tunables read it); field storage in `src/features/arena/`.
- Naming: `setCellSlot` → `writeSample` (the one write path, D6); `TerrainGrid` keeps its name (D2).
- Performance: seeding is once per load, bounded by each shape's box + band; a crater touches only its box. Start arena 1920 × 1440 at 4 units = 172 800 samples → ~0.7 MB Float32 + 2 bytes each. Renderer chunks are 64 units (16 samples) instead of 128: 4× the chunks, each drawn only when dirty.
- Testing: TDD on the pure parts (signed distance, seeding, crater rim); existing arena / combat / level-file / player tests re-run at their own fixture cell sizes.
- Game juice: no new moment.

## Acceptance tests (written first, failing)

- `src/shared/utils/shapeGeometry.test.ts` — signed distance for rect, circle, polygon (inside positive, outside negative, 0 on the edge).
- `src/features/arena/services/terrainField.test.ts` — seeded distance within one sample of the true edge distance; anchored for stone and the bottom row; a round crater's rim on `|p − c| = reach ÷ toughness` (cardboard wider than earth), solid ⇔ distance > 0, touched box reported.

## Phases

1. **Geometry (TDD):** `shapeSignedDistance`; `craterShapeDistance("round")`. Gate: tests green.
2. **Field storage + seeding:** grid `distance`, `anchored`; `writeSample`; raster seeds distance (band ±4 samples) and anchored. Gate: arena tests green, type-check.
3. **Crater on the field:** `clearCrater(grid, { x, y, reach, shape })` lowers distance, clears at ≤ 0, returns `box`; combat passes the weapon's `craterShape`. Gate: combat + arena + level-file tests green.
4. **Spacing 4:** catalog default, shipped levels, LEVEL_FORMAT, kit regen; full test run (player / match tests at the new spacing). Gate: `pnpm test:run`, lint, arch, validate:*, level-kit:check.
5. **Docs:** arena / combat READMEs (decisions D1–D7).

## Review

Self-pass (weekday budget) against the brief, rules and code: A1 — keep the slot as the solidity truth for every existing query and make distance follow it exactly (no second solidity test until a3).
