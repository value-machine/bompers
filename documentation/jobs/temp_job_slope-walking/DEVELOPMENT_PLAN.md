# Development plan: Slope walking (motor and gravity on the terrain field)

## Summary

- **Goal:** grounded blobs walk up and down curved terrain on the distance field: the body's round bottom rides the field contour, ground speed is a motor plus gravity along the slope, crater lips are pulled over, and the body tilts with the ground (render only).
- **Why:** owner (direct, 2026-11-16): walking out of a blasted hole blocks or steps; steepness should change speed; characters should tilt (design A picked in the artifact).
- **Brief:** `BRIEF.md`
- **Size:** M — arena field queries, player body shape + ground mover, render tilt, tunables, docs.
- **Acceptance test:** `src/features/player/services/playerController.test.ts` › `describe("slope walking")` (written first, fails on main's step-up mover).
- **Plan review:** Done 2026-11-16 (`plan-review.md`, weekday-reduced: one merged-lens reviewer, see Notes)
- **Scope / constraints:** no new dependency; sim stays deterministic and DOM-free; player services layer is at its 10-file budget (no new files there).

## Phase overview

| Phase | Goal | Gate | Status |
|-------|------|------|--------|
| 1 | Field queries for round bodies (arena) — POC | `pnpm test:run src/features/arena`, type-check | Done (field within 1 unit at 14) |
| 2 | Player body: box top + round bottom on the field; contact by bisection | full player + combat + collectibles tests, type-check | Done |
| 3 | Ground mover: motor + gravity along the contour, lip rule, leaving the ground | acceptance tests green, full `pnpm test:run` | Done (A1–A3, A6, A7; launch rule via `stickRadius`, see Notes) |
| 4 | Render tilt from the ground angle | blobPose tests, type-check, lint | Done |
| 5 | Tunables, docs, cleanup (retire step-up + snap) | all gates (loop-check list) | Done |

## Conflict & compliance

- **Applicable rules:** architecture (layers, feature budgets, cross-feature via `arenaApi` only), code-style (naming F1: role names `fieldDistanceAt`, `fieldNormalAt`, `roundBodyHitsSolid`; complexity limits), testing (colocated, "should … when …"), game-juice (tilt is a pose, not a new moment: no ledger row; land/jump moments unchanged), debugging (reductive: step-up and snap removed, not layered), agent-behavior (no protected files touched).
- **Placement (validated against `projectStructure.config.cjs` patterns already in use):**
  - `src/features/arena/services/terrainField.ts` + `terrainField.test.ts` (new; arena services 8 → 10 files, at budget).
  - `src/features/arena/api/arenaApi.ts` exports the three queries.
  - `src/features/player/services/playerController.ts` (body shape, ground mover; no new files in player services, budget 10/10).
  - `src/features/player/services/blobPose.ts` (+ test) ground-tilt spring; `playerRenderer.ts` applies it.
  - `src/features/player/types/player.types.ts`: `groundSpeed`, `groundAngle`.
  - `src/shared/config/gameTunables.ts` + `src/shared/types/gameTunables.types.ts`: `player.slope`, `feel.groundTilt`.
- **Layers:** player → arena via `arenaApi` (existing seam); arena does not import player.
- **Data / security:** none. **Feature READMEs:** arena, player.
- **Body shape decision (D7, clear winner):** top half stays a box (head, shoulders: walls and ceilings as today, cell-based `rectHitsSolid`); bottom half is a circle of radius width/2 tested on the field (`fieldDistanceAt(centre) > −radius`). A circle bottom never lets the box corners touch a slope tangent to it (proof: corner height margin R·cos θ − R(1 − sin θ) tan θ > 0 for θ < 90°), and it lands on slopes where the grounded mover keeps it, so there is no landing snap. Rejected: box with a separate feet circle (a box overlapping terrain cannot take off), full circle (design C).

## Phases

### Phase 1 — Field queries (POC)

1. `terrainField.ts`:
   - `fieldDistanceAt(grid, p)`: bilinear field at a world point (positive inside, clamped band outside the grid).
   - `fieldNormalAt(grid, p)`: unit normal pointing out of terrain (−gradient by central difference of `fieldDistanceAt`, h = half a sample); `{0,-1}` when flat or undefined.
   - `roundBodyHitsSolid(grid, { centre, radius })`: `fieldDistanceAt(centre) > −radius`.
2. Tests: distance within 0.5 of the true distance near a slab top and a crater rim, out to radius 14; normal within 5° of the true normal on a 30° ramp and a crater wall; hits / free at radius ± 0.5.
3. **POC kill switch:** if the field error at 14 units exceeds 1 unit (band is 16), raise `FIELD_BAND_SAMPLES` to 5 in Phase 1 (arena-only change, memory +0) and record it in DECISIONS.

Gate: `pnpm test:run src/features/arena`, `pnpm type-check`.

### Phase 2 — Body shape

1. `bodyHitsSolid(player, terrain)` in the controller: top rect `{x − w/2, y − h, w, h/2}` on cells, or the bottom circle (centre `(x, y − h/2)`, radius `w/2`) on the field.
2. `moveAxis` uses it; on a hit, bisect back to the free position (6 halvings of the sub-step, < 0.05 units) instead of `snapAfterHit` (removed).
3. `probeWall`, `scanGroundBelow`, `groundGrip` keep their strip probes (box sides and the line under the feet), unchanged.
4. Run the existing player, body-collision, tumble, combat, collectibles and dive tests; failures get a test-authority verdict (expected y on cell rows vs contact on the contour, ≤ 0.1 apart).

Gate: `pnpm test:run src/features/player src/features/combat src/features/dive src/features/collectibles`, type-check.

### Phase 3 — Ground mover (design A)

1. State: `groundSpeed` (signed, along the ground), `groundAngle` (rad, + = rising to the right).
2. Grounded step (replaces `moveAcross` + `climbRiser` + `snapToGround` while grounded):
   - normal n = `fieldNormalAt(centre)`, tangent t = (−n.y, n.x); slope sin θ = −t.y (along +x travel).
   - push = `groundAccel × clamp(slope.motorGain × (1 − v·dir / runSpeed), −1, 1) × grip × steer` toward the input; no input → today's decel toward 0 (× grip).
   - pull = `slope.pull × t.y` (gravity component along the tangent).
   - lip: travel slope ≥ `slope.lipAngle` and the body is free at `centre + (dir·2, −slope.lipRise)` → speed at least `slope.lipSpeed × runSpeed` toward the lip; ≥ lipAngle and not free → no push.
   - move the centre by v·dt along t in sub-steps ≤ half a sample; after each, settle onto the contour: `centre += n·(fieldDistanceAt(centre) + R)` twice (Newton on the field), then keep it only if the top box is free; else stop like a wall (`terrainHitX`, v = 0).
   - leave the ground when settling would pull the body down more than `slope.stickDistance` (8) in one sub-step, or on a jump: vx, vy = v·t.
   - write back vx, vy = v·t so every other system (body contacts, effects, pose) keeps reading world velocity.
3. Airborne → grounded: a y-hit while falling sets `groundSpeed` = vx·t.x + vy·t.y (keeps speed into a slope).
4. Acceptance tests (written first):
   - **crater exit:** earth slab, round crater reach 34 at the surface, blob grounded at the bottom, hold right 3 s → x past the right rim + 14, feet on the top surface, `jumpCount` 0.
   - **ramp speeds:** 30° ramp polygons; steady ground speed within 5 % of `runSpeed × (1 − pull·sin θ / (motorGain·groundAccel))` up and down.
   - **smooth path:** over a crater exit, no per-step centre displacement above `runSpeed·dt + 0.5`.
   - **flat feel kept:** flat run reaches `runSpeed` and stops as fast as before (± 1 step).

Gate: acceptance tests green, full `pnpm test:run`.

### Phase 4 — Render tilt

1. `blobPose.ts`: `groundTilt` damped spring targeting `clamp(share × groundAngle, ±max)` while grounded, 0 in the air; reuse `createDampedSpring` / `stepDampedSpring`.
2. `playerRenderer.ts`: rotate the body container (body, helmet, eyes) by the spring; feet stay as today.
3. Test: tilt settles at 0.6 × 20° = 12° and clamps at 30° on 60°.

Gate: `pnpm test:run src/features/player`, type-check, lint.

### Phase 5 — Tunables, docs, cleanup

1. Tunables: `player.slope { motorGain: 2, pull: 3900, lipAngle: 80°, lipRise: 12, lipSpeed: 0.25, stickDistance: 8 }`, `feel.groundTilt { share: 0.6, maxDegrees: 30, stiffness, damping }`; remove `player.stepUp` and its comment.
2. Docs: player README (ground mover, body shape), arena README (`terrainField`), DESIGN_LANGUAGE § 6 (tilt), DECISIONS → READMEs; terrain-curves D6 superseded note.
3. Level kit sync if tunables are mirrored there (`pnpm level-kit:check`).

Gate: loop-check tooling list.

## Pattern & precedent

- Ground speed along the surface with a slope factor and floor sensors is the standard 2D model for curved ground (Sonic-style). Worms-likes use pixel step-up on destructible terrain, which is what we replace. A round bottom under a flat-topped box matches capsule-bottom character controllers. Adopted from those precedents (A1): a slope limit, snap-to-ground only while velocity doesn't point away, and launch off convex edges at speed. Divergence: a lip pull-over past the slope limit, because every crater ends in a near-vertical rim (D3).

## Review contract

- Rules pinned at: `git log -1 --format=%h -- .claude/rules` (recorded at review time).
- Required lenses: naming generality, rebel, scale / modularity, precedent; rule compliance: code-style, architecture, testing.
- Tooling gates: type-check, test:run, lint (≤ main's warnings), arch:check, validate:structure / feature-size / feature-docs, level-kit:check.

## Amendments

These supersede the phase text above where they differ.

| id | change | source |
|----|--------|--------|
| A1 | Pattern & precedent: ground snap follows standard controller limits: leave the ground when velocity points out of the surface (v·n > ε), at a maximum ground angle (lip angle 80°, except a lip pull-over), and at a convex edge when the ground falls away from the tangent faster than gravity can follow (ledge launch at speed, roll-over when slow). No `stickDistance`. | plan-review (precedent, contract) |
| A2 | No stored `groundSpeed`: each grounded step derives it as (vx, vy)·t, so knockback, dive, recoil and body contacts keep working; only `groundAngle` is stored (for tilt). | plan-review |
| A3 | Ground move = horizontal sub-step + vertical settle onto the contour (`settleCircle` in arena `terrainField.ts`: lift up to \|dx\|·tan(lip angle), drop down to the same), not tangent Newton steps: walls stay walls at concave corners. Blocked → lip pull-over if the body is free 12 units up, else a wall. | loop-build (POC) + plan-review |
| A4 | Head box: inset by half a sample at its sides and bottom (bottom edge one sample above the body centre), cells as today; the round bottom is on the field. Keeps cell quantisation (≤ 2.8 units) off steep slopes up to the lip angle. | plan-review |
| A5 | `FIELD_BAND_SAMPLES` 4 → 5 so the field and its normal stay exact at body-radius distance. | plan-review |
| A6 | Airborne x-moves that touch floor-like ground (normal within the lip angle of up) slide up the slope instead of stopping: no x-hit, no false dive bonk or tumble bounce. | plan-review |
| A7 | Slope speed (implements D1 with flat feel unchanged, D8): grounded target speed = runSpeed × (1 − uphillLoss·sin θ) uphill, × (1 + downhillGain·sin θ) downhill; approach it at today's accel / turn / decel rates; above target on a slope, keep speed at `slope.carryDecel` (run-up carries); past runSpeed downhill, build speed at gravity × sin θ. No input: today's decel; no pull, so a blob stands still on slopes. | plan-review + loop-build |
| A8 | Names: `circleHitsSolid` (sits beside `rectHitsSolid`), `center` spelling. | plan-review (naming) |
| A9 | Extra tests: walk off a ledge → airborne; grounded knock-up leaves the ground; jump uphill keeps vx; stands still on a 20° slope; no new landings walking over a crater rim. Existing tests are the shipped ground truth (testing § Test Authority). | plan-review |

## Notes during development

- Weekday token budget: the plan review ran as one merged-lens reviewer instead of the full fan-out; the full fan-out can run at the weekend if the owner wants it.
- Build: the first leave rule (drop below the tangent vs gravity per sub-step) launched blobs on gentle hills from tiny slope-reading noise. It was replaced by speed² × curvature > g × cos θ, applied only to edges sharper than `stickRadius` (56) and never while climbing, so hills and crater exits hold the feet and ledges still launch at speed.
- Build: `FIELD_BAND_SAMPLES` 5 makes the blast re-measure reach one more chunk (`terrainGrid.test.ts` expectation updated with a verdict); the re-measure's sample-hop estimate stays a lower bound away from fresh rims (terrain-curves D9).
- Review advisories kept as notes: per-step cost is fine (≈ 10 bilinear reads per sub-step, ≤ 4 sub-steps, 4 players); `playerController.ts` size is watched (the circle settle lives in arena, A3).
