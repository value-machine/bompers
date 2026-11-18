# Development plan — double-jump-bash (M)

Brief: `BRIEF.md`. Decisions: `DECISIONS.md`. Controller edits wait for the orchestrator's go on the collision-sound fix; rebase on main first.

Acceptance test (failing, written): `src/features/match/services/gameSim.test.ts` § "gameSim — jump dive (double-jump-bash D1)": armed air press → dive travels right, no rocket spent; jump held through the dive → dash roll; a first jump press never dives (passes today, guards the regression).

Conflict & compliance: no new files (structure unchanged); imports stay player ← dive (dive already imports `playerApi`), no new cross-feature edge; no data, security or dependency impact; GAME_JUICE: same moment as "Dive launch" (no new row; ledger note that it has two inputs). Naming (code-style F1): `airJumpPressCount` (what happened, not who reads it), `RollHoldButton` / `holdButton`, `DiveTrigger`.

Phase 1 — player (after the orchestrator's go on the collision-sound fix; rebase on main first)
- `player.types.ts`: `airJumpPressCount: number` (monotonic, D3); `rollHold: "fire" | "jump" | null`; `createPlayer` / `placePlayer` init.
- `playerController.ts` `applyJump`: after ground / coyote / wall, if the buffer is live, not locked, and no ground within `max(vy, 0) × jumpBufferTime + 4` below the feet (`groundBelowY`) → `airJumpPressCount += 1`, buffer consumed (D2, D9). Ground within reach → buffer kept (landing jump).
- `roll.ts`: `startRoll` takes `holdButton` for source `dash` (default `fire`); `releaseRoll` ends a dash roll when that button is up.
- Tests in `playerController.test.ts` (air press counted; not counted on ground, in coyote, at a wall, near landing; a locked press counted once the lock ends) and `roll.test.ts` (dash roll held by jump ends on jump release).
- Gate: `pnpm vitest run src/features/player`, `pnpm type-check`, `pnpm lint`.

Phase 2 — dive
- `dive.types.ts`: `DiveMotion.trigger: "fire" | "jump"`, `DiveState.airPressSeen: Record<id, number>` (last counter value read, per player, so respawn / new players start at their current count).
- `diveSim.ts`: `stepDives` reads each player's `airJumpPressCount` against `airPressSeen`; a rise opens the dive's request buffer with trigger `jump` (`requestDive(dive, player, tunables, trigger)`, fire stays the default). `startWindup` stores the trigger; `rollOnIfHeld` checks the trigger's button and passes it as `holdButton`.
- No change in combat or match: armed fire still goes to weapons; the jump path needs no hook.
- Tests in `diveSim.test.ts`: a counter rise starts a dive for an armed player (no combat hook involved); shared charge (fire dive then jump press in the same airtime → no second dive); a reset pickup refills it for the jump path; jump-held roll vs fire-held roll.
- Gate: acceptance test green, `pnpm vitest run src/features/dive src/features/match`, `pnpm type-check`, `pnpm lint`, `pnpm arch:check`.

Phase 3 — docs
- `dive` README: "How it works" second input + D1/D5 rows; `player` README: counter + roll hold button rows; GAME_JUICE "Dive launch" row note (jump or fire).

Phase 4 — roll carry (D10–D14; player + dive, controller part after the go)
- Tunables: `roll.jumpCarryMax` (600, horizontal speed a jump keeps from a roll), `roll.airCarryDecel` (150 / s, how fast carried speed above run speed bleeds in the air while the stick holds that way), `dive.rollCarryMax` (1100, the most speed a dive out of a roll launches at).
- Player: `PlayerState.airCarrySpeed` (generic: "air steering does not brake below this while holding that way"). `launch` out of a roll sets it to `min(|vx|, jumpCarryMax)`; `applyHorizontal` in the air: while `|vx|` is above run speed, the stick points along `vx` and `|vx| ≤ airCarrySpeed`, bleed at `airCarryDecel` instead of steering to run speed; cleared on landing, wall contact, a wall jump, a hit roll and when it bled to run speed. Speed above `airCarrySpeed` (a blast) steers as today, so rocket jumps gain nothing.
- Dive: a dive may start from an unlocked roll (dash roll, or a hit roll whose lock ran out); it ends the roll (`endRoll` via `playerApi`). `startWindup` stores the speed along the aim before the wind-up slows it (`carry = max(0, v · dir)`); `launch` uses `max(launchSpeed, min(carry, rollCarryMax))`. Only from a roll: a fast fall or blast does not feed a dive (D13).
- Tests: `playerController.test.ts` (a jump out of a fast roll lands ≥ 25 % farther than a standing-start running jump; a blast above the carry speed bleeds as today; carry clears on landing); `diveSim.test.ts` (a dive out of a fast roll travels farther than from standing, never above `rollCarryMax × travelSeconds`; a hit roll still locked cannot dive); `matchRules.test.ts` or the margin check: carried jump reach and a carried dive up stay inside `outOfBoundsMargin`.
- Gate: as phase 2, plus `pnpm vitest run src/features/match/services/matchRules.test.ts`.

## Conflict & compliance (additions)
- Recorded decisions touched: dive README "A rolling blob cannot start a dive" (replaced by D12: unlocked rolls can); player README roll exits gain "a dive once unlocked ends it". Owner asked for the carry, so these are owner-driven updates, not conflicts to ask.
- Map edges (open-map-edges D1a): carry is capped below the margin's launch speed; checked by test, margin formula unchanged.

## Review
Size M: one merged plan review (loop-plan § 8) runs at the start of loop-build, before the first code edit; must-fixes land here as Amendments.
