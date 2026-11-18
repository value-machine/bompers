# Development plan: fire on moving parts (mover-materials lap 2a)

## Summary

- **Goal:** fire runs on every body of the arena, so a cardboard part lights, spreads, hurts and burns away like cardboard ground.
- **Why:** route D1 (one world of bodies); the owner's request that parts take their material's fire.
- **Brief:** `BRIEF.md`
- **Size:** M — fire's state, sim, renderer and tests change shape; one arena drawing change; text changes.
- **Acceptance test:** `src/features/fire/services/fireSim.test.ts` › "fire on moving parts" (written with phase 2, after the refactor; it was not seen red first, which the plan asked for).
- **Plan review:** one merged review, findings applied as Amendments.
- **Scope / constraints:** no player controller or roll; no cold on parts; no new look or sound.

## Phase overview

| Phase | Goal | Gate | Status |
|-------|------|------|--------|
| 1 | Fire's ground state per body; behaviour on static terrain unchanged | type-check; fire, ice, match tests | Done |
| 2 | Torch lights parts; spread, douse, burn-out per body; blobs catch from a burning part; sound count | acceptance test green; fire tests | Done |
| 3 | Fire layers per body, following the part's pose; part fill and ink follow its field | type-check, lint; renderer tests (in `fireSim.test.ts` › "fire layers per body" and `terrainSurfaces.test.ts` › "moving part view"; fire and arena are at their file budgets, so no new test files) instead of a headless run: no built-in level has a burning part | Done |
| 4 | Format text (§ 11, W13, prompt, kit), READMEs, GAME_JUICE ledger, decisions folded in | tooling gate | Done |

## Conflict & compliance

- Applicable rules: architecture (layers: fire → arena api; shared has no feature imports), code-style § Naming (F1 role names: `GroundFire`, `bodyGrids`; F2: the body lookup now has stains, rays and fire — fire uses the arena's list, no new copy), game-juice (reuse of picked moments, ledger row), testing (expected values from the shipped tunables), file-placement (no new folders).
- File placements: all in existing files except the lap docs; `fire` budget checked with `pnpm validate:feature-size`.
- Reuse / packages: skipped — bespoke game logic.
- Foundation cleanup: `FireState` mixes ground fire, sprays and blob fire; this lap separates the ground part (needed, not extra). No other cleanup.
- Risks: (a) regressions in tuned fire → static-terrain tests stay, only their accessors change; (b) a part's fire drawn in a turning frame (D4); (c) burn-out rule may change with D1 → kept in one place (`stepFire`'s batch and the part clip).
- Standards diversions: none.

## Review contract

- **Rules pinned:** `rules@` current head of `.claude/rules` — architecture, code-style, testing, game-juice, file-placement.
- **Required lenses:** Feature decomposition, Foundation cleanup, Naming. Pattern & precedent: covered by the route's options page (owner pick). Reuse / packages: skipped (bespoke).
- **Tooling gate:** `loop-check/references/rule-audit.md` § Tooling pass.
- **Locked decisions:** route D1–D3; this lap's D2–D4; fire README decisions (spread, burn-out batch, blob rules) unchanged.

### Amendments

| # | Date | Source | Change | Applied to |
|---|------|--------|--------|------------|
| A1 | 2026-11-18 | plan review, must-fix 1 (code-style F2) | The pose-following layer existed twice (terrain part view, goo stains); fire is the third. One arena helper `createPoseLayer` / `placePoseLayer`, used by all three | `terrainRenderer.ts`, `knockoutRenderer.ts`, `fireRenderer.ts`; brief edge `knockout` |
| A2 | 2026-11-18 | plan review, must-fix 2 | Local-to-world of a body's point has one home that includes the part's origin: the arena's `bodyWorldPoint` (debris spots, `fromX`, smoke) | `terrainGrid.ts`, fire sim / blobs / renderer |
| A3 | 2026-11-18 | plan review, advisory 1 (promoted) | A part's clip covers only its breakable slabs, by its `breakableRegion`, as static terrain does; stone slabs are not re-cut | `terrainRenderer.ts` |
| A4 | 2026-11-18 | plan review, advisory 3 (promoted) | The merged batch carries no sample `box`; combat's report takes `byLook` only | `fireSim.ts`, `explosions.ts`; brief edge `combat` |
| A5 | 2026-11-18 | build | W13's material warning only for a breakable material that does not burn: a cardboard part is a valid choice now and warned on every import | `levelFileMotion.ts`, LEVEL_FORMAT § 7 |
| W1 | 2026-11-18 | plan review, advisory 2 (waived) | `bodyGrids` stays beside `terrainBodies` (same order, one derives from the other's source); renaming `GroundFire` to `BodyFire` not taken: "ground" is the fire feature's word for what burns under blobs | — |

## Phases

### Phase 1 — state per body

1. `fire.types.ts`: `GroundFire` = `front`, `igniteAt`, `frozenSeen`, `lit`, `litHead`, `dueOut`, `scorched`, `version`. `FireState.grounds: GroundFire[]`; `nextBurnOutAt`, `sprays`, blob fields stay.
2. `arena`: `bodyGrids(terrain)` → `[terrain, ...movers.map(field)]`, same order as `terrainBodies`; exported.
3. `fireSim.ts`: `createFireState` builds one ground per grid; `ignite(fire, terrain, { body, index, time })`; `spread`, `douseFrozen`, `collectBurnt` take a ground and its grid; `burningSamples(ground)`; `burningCount(fire)` for sound.
4. Readers follow: `torch.ts` (body 0 only, as lap 1), `burningBlobs.ts`, `fireRenderer.ts` (ground 0), `matchSound.ts`, tests' accessors.

### Phase 2 — fire on parts

1. Acceptance tests first (red): torch on a cardboard part lights it; spread time across the part = distance ÷ `fire.spreadSpeed`; nothing lit on the static grid; a stone part never lights; a blob touching the burning part catches; after `burnSeconds` + a batch beat the samples are empty in the part's field.
2. `torch.ts`: act on `hit.body` (thaw first when that grid's sample is frozen, else ignite).
3. `stepFire`: every ground steps; on the batch beat each ground's `dueOut` goes through the arena's `burnOut` on its own grid; the returned batch merges `removed` and `byLook`, with spots in world coordinates (`posePoint` for a part).
4. `burningBlobs.ts`: `catchFromTerrain` also scans each part's field around the blob's centre mapped into the part's frame; `fromX` is the sample's world x.

### Phase 3 — drawing

1. `fireRenderer.ts`: the terrain-layer graphics become one set per body (`GroundFireView`); a part's set sits in a container with the part's pivot, placed by its pose each frame; smoke puffs are born at the world point of the burnt sample.
2. `terrainRenderer.ts`: a part's fill is clipped by its field's contour and its ink redrawn when the field's `shapeVersion` changes (the same one-rule outline as static breakable terrain).

### Phase 4 — text and records

1. LEVEL_FORMAT § 11 and W13, `levelFileMotion.ts` W13 message, `levelPrompt.ts` moving-parts line, kit export regenerated by its script.
2. READMEs (fire, arena, match, level-file, level-kit), GAME_JUICE ledger row, decisions folded into the READMEs.

## Juice table

| Moment | Tier | Sound | Visual | Source |
|---|---|---|---|---|
| A part catches, burns, burns out | fire's own (unchanged) | fire loop by burning-sample count (parts counted), `burn-out` per batch | fire body + flames + smoke in the part's frame | reuse of fire-clusters D1, fire-visuals D1 (owner picks); no new look |
