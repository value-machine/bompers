# Development plan — player-movement

Brief: `BRIEF.md` · Decisions: `DECISIONS.md`

## Acceptance test (first, failing)

`src/features/player/services/playerController.test.ts`: accel ramp, jump apex vs gravity (and half gravity = 2×), early release lower apex, coyote jump, buffered jump, wall-slide cap, wall-jump direction, aim fallback to facing.

## Phases

1. **Tunables + state.** `player` section: width, height, runSpeed, groundAccel, groundDecel, turnAccel, airAccel, jumpSpeed, jumpCutMultiplier, coyoteTime, jumpBufferTime, wallSlideSpeed, wallJumpSpeedX, wallJumpSpeedY, wallJumpControlLock, + render squash numbers (`squash`). `PlayerState` new fields. Gate: type-check.
2. **Controller (TDD).** Split `playerController.ts` into input→intent, horizontal, jump, motion/collision, contact probes (wall, ground-below). Keep exports. Gate: tests green, lint complexity clean.
3. **Pose math (pure).** `services/blobPose.ts`: squash scale from events + time (area kept), feet deform, idle breath, shadow geometry. Unit tests. Gate: tests.
4. **Renderer.** `playerRenderer.ts` draws the blob from pose; palette keys in `gamePalette.ts`. Gate: headless Chromium screenshot + movement check.
5. **Docs.** player README (structure, decisions), ARCHITECTURE game module map row if it names the placeholder.

## Pattern & precedent

Celeste / Hollow Knight-style platformer feel: coyote ≈ 0.1 s, buffer ≈ 0.1 s, jump cut on release, wall-slide cap, wall-jump with a short input lock. Squash from event counters is the usual sim/render split for fixed-step games.

## Conflict & compliance

No new dependency. Files stay within the player feature + shared config sections. `stepPlayers` signature unchanged.
