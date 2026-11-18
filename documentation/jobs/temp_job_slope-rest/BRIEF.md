# Brief — One stable contact against ground steeper than the lip angle

Task: "sim side of the slope-meets-wall flip" (owner, 2026-11-18) · Lap: temp_job_slope-rest · Size: XS · Harness: v0.45.0 · Stacked on `claude/leg-locomotion` (value-machine/bompers#59)

## Problem

A blob pushed into ground at or above `player.slope.lipAngle` (80°) alternated every sim step between grounded (ground angle about 82°) and airborne with `wallDir = 1`: `groundOutcome` returned "air" for steep ground without a free lip, `moveInAir` landed it again one step later, and `landCount` grew each time.

## Success check

`playerController.test.ts` § "resting against ground steeper than the lip angle": pushing into the top of the quarter arc for 180 steps, `grounded` stays true, `wallDir` stays 0, `landCount`, position and velocity do not change.

## In scope

`groundOutcome` / `moveOnGround` in `playerController.ts`, the controller tests, the arc test in `blobPose.test.ts` that asserted the flip, the player README.

## Out of scope

- Slope walking below the lip angle, the lip pull, wall-jump: unchanged.
- Removing `stepContactHold`: waits for the owner's go (see DECISIONS).
- The one short hop where a climb reaches the lip angle with speed left (the blob leaves the ground and lands once).

## Plan

1. Failing controller test on the arc fixture (second copy of the fixture, marked).
2. `groundOutcome`: on steep ground with speed below `STEEP_REST_SPEED`, return "rest" (grounded, stopped, no terrain hit reported).
3. Replace the flip assertion in `blobPose.test.ts`; fold D1 into the player README.
