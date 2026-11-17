# Development plan — moving parts, lap A (format, importer, preview, prompt)

Brief: `BRIEF.md` · Ledger: `DECISIONS.md` · Size M · Branch `claude/moving-parts` (Model C)

## Conflict & compliance

- LEVEL_FORMAT § 5 says `<g>` is "grouping only". This lap adds one optional attribute to `<g>` (additive, no format bump, § 8). The no-transform rule (W3) stays.
- `data-behavior` stays reserved for catalog behaviours. Motion is geometry, not a catalog ID (D1).
- Placement: `src/shared/types/levelMotion.types.ts` and `src/shared/utils/levelMotion.ts` (+ test). They live in shared because level, level-file and level-kit use them now, and arena/match will in lap B. `src/features/level-file/services/levelFileMotion.ts` (+ test). Existing files elsewhere.
- Layers: shared ← features only; level-file imports shared + level api. No cross-feature internals.
- Naming (code-style F1): role names `levelMotion`, `motionPose`, `posePoint`; there is no first-consumer naming.
- F2: `public/level-kit/v2/preview.js` holds the second copy of grammar + pose (plain browser JS cannot import TS). Each copy carries a marker naming the other.
- Feature READMEs: `level` (movers field), `level-file` (motion import, W12–W14), `level-kit` (prompt section).
- Lap A changes no runtime: the arena still rasterises every terrain piece, mover pieces included.

## Pattern & precedent

Kinematic platforms with a time-based path (Unity/Godot AnimatableBody, Celeste/Mario moving blocks) are the precedent. Authoring follows SVG/SMIL thinking (`animateMotion`), but as one compact token string so it costs fewer tokens and has no nested elements.

## Acceptance test

`src/features/level-file/services/levelFileMotion.test.ts`:
- `<g data-motion="slide 0,-160">` around one terrain rect imports with `movers[0]` = slide (offset 0,-160, period 4, phase 0), with the pivot at the bbox centre and `terrainIndices` naming the rect.
- `motionPose` at t = 2 s gives `dy = -160`.
- A bad grammar yields W12 and no mover. A sweep through static terrain yields W14.

## Phases

1. **Shared motion model.** Add the `LevelMotion` union and `LevelMover` to the shared types. Add `levelMotion.ts` with `MOTION_DEFAULTS`, `MOTION_LIMITS` (period 1–30 s, max 16 movers, ride speed = run speed), `MOTION_PIVOTS`, `motionPose(motion, t)`, `posePoint` / `unposePoint` and `motionPeakSpeed`. Add `shapeBounds` and `shapeOutlinePoints` to `shapeGeometry.ts`. Gate: unit tests + type-check.
2. **Importer.** Add `levelFileMotion.ts`:
   - `collectMovers(root, items, terrainEls)`: outermost `g[data-motion]`, then grammar parse, W12 / W13, pivot from the bbox of the group's pieces.
   - `checkMoverSweeps(level-ish)`: W14 for leaving bounds, overlapping static terrain, covering a spawn, and too fast.
   - Wire it into `levelFileParser.readContent`, add `movers` to `LevelDefinition` (optional) and the W12–W14 codes, plus one engine note "moving parts stand still in this version of the game".
   - Gate: acceptance test + parser tests.
3. **Prompt + docs.** Add a `### Moving parts` block under § 3 of `buildLevelPrompt`: grammar, defaults, pivots, alignment rules, one worked snippet, and a checklist line. Add LEVEL_FORMAT § 5 row + § 7 W12–W14 + new § 11, and an AUTHORING.md section. Add one sliding platform to example-level.html. Then run `pnpm level-kit:sync`. Gate: levelPrompt tests, `level-kit:check`.
4. **Preview kit.** In `preview.js`: parse `data-motion`, animate through CSS `style.transform` (not the attribute, so the transform check stays quiet), draw dashed ghosts at the extreme poses, add a legend count, a "Motion" toggle and validation messages. Respect `prefers-reduced-motion` (start paused). Gate: one headless smoke run of example-level.html that reads the console and the logged transform.
5. **Fold decisions** into the READMEs and LEVEL_FORMAT, then delete the lap folder at ship per the loop.

## Review

Weekday token budget (agent-behavior § Token budget): the size-M plan-review fan-out is folded into loop-check's lens pass instead of running twice.
