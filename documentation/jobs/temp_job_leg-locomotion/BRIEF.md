# Brief — Leg animation: wall and slope as one system

Task: "Leg animation from wall walk and arced slope walk should transition nicely or be one system" (owner, 2026-11-17) · Lap: temp_job_leg-locomotion · Harness: v0.45.0

Status: the owner picked **B, one surface frame** (D1). Plan (size S): acceptance test "should turn the feet without a snap when a steepening slope becomes a wall" in `blobPose.test.ts`; replace `normalFoot` / `wallFoot` and the wall blend with one sprung angle and `placeFoot`; `feel.feet.surface` replaces the five wall tunables; fold D1 into the README and DESIGN_LANGUAGE § 6. Option C is not built (D4).

## Problem

The feet have two unrelated poses (`normalFoot`, `wallFoot` in `blobPose.ts`), switched by the sim's "airborne + wallDir" flag, so they jump when a blob runs up a curved slope into a wall or wall-jumps back onto a slope.

Found in v0.45.0 (`src/features/player/services/blobPose.ts`, `playerRenderer.ts`):

1. Ground feet sit side by side in the root's frame; wall feet stack on one side at ±90°. `stepFeetMotion` lerps x, y and rotation between them in 80 ms (`wallBlendSeconds`), so the feet cross through the body.
2. The wall weight follows `!grounded && wallDir !== 0`. The slope becomes a wall at `lipAngle` (80°); just before, the feet are tilted by the root lean only (60 % of the slope, at most 30°), one step later they turn to 90°.
3. `stepCycle` runs on `player.x` and `|vx|` and only while grounded: it slows on steep ground, stops when the blob leaves it and never runs on a wall.
4. Feet are placed around the feet point (bottom of the body circle); on a steep slope the circle touches with its side, so the feet hang above the ground.
5. After a wall-jump the feet hold the wall pose 120 ms (`wallJumpHoldSeconds`), blend to the air pose and snap to the ground pose on landing; only the lean (`stepGroundTilt`) eases.

## Success check

Pending the pick. For option B: for a blob moved along a quarter arc from flat ground into a wall, the angle between each foot's sole and the surface under the body never changes by more than a small bound between two frames, and the step phase advances with distance along the surface on floor, slope and wall alike.

## In scope

- The picked redesign of foot placement and rotation in `blobPose.ts` (feet section) and `placeFeet` in `playerRenderer.ts`, its `feel.feet` tunables, tests in `blobPose.test.ts`.
- DESIGN_LANGUAGE § 6 feet line, GAME_JUICE where it names the feet, player README.

## Out of scope

- Will NOT do: wall-jump body rotation (README: "not built yet") — deferred.
- Will NOT touch: the controller, slope physics, roll, wall-slide speeds; body squash, helmet spring, crouch pose; knockout / fling (#50) and moving-part riding (#57) code paths.
- Will NOT touch: `src/config/app-tasks.json`.

## Edges

| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| `player` (render pose) | `syncPlayersView` → `placeFeet` → `stepFeetMotion` → `normalFoot` / `wallFoot` lerp | `blobPose.ts` feet section, `playerRenderer.ts` `placeFeet` | ride — same seam, new pose maths |
| `shared/config` tunables | `feel.feet` read by the renderer | `gameTunables.ts` `feel.feet` | ride — keys added or removed |
| `documentation/game` | § 6 describes the feet | DESIGN_LANGUAGE § 6, GAME_JUICE § 4 | ride |
| `match` (option C only) | `gameRenderer.ts` passes `feet` tunables | would pass terrain to `syncPlayersView` | new — only if C is picked; needs the orchestrator's go |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size

A: S · B: S · C: M (new per-foot state, terrain into the renderer). Cut into laps: none.

## Decisions

DECISIONS.md D1 (open): which redesign.
