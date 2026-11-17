# Development plan — shared-roll

Brief: `BRIEF.md` (size M). Decisions: `DECISIONS.md`.

## Conflict & compliance
- Rules: architecture (roll stays in `player`, dive reaches it via `playerApi`), code-style § Naming (tumble → roll: F3 rename incl. guidance), testing (colocated `roll.test.ts`, `should … when …`), game-juice (ledger rows below).
- Placement: `src/features/player/services/roll.ts` + `roll.test.ts` replace `tumble.ts` / `tumble.test.ts` (same folder, whitelisted). No new feature, no new dependency.
- Recorded decisions touched: dive-headbutt D10 (tumble lives in player) — kept, renamed; tumble `minImpulse` threshold (blast-power) — replaced by continuous strength per owner.
- Sound id `tumble-bounce` kept (asset file id; content name, not code mechanism) — D8.

## Design
- `PlayerState`: `rollSource: "hit" | "dash" | null`, `rollLockSeconds`, `rollSeconds`, `rollAngle`, `rollSpin`, `rollCount`, `rollEndCount`, `rollBounceCount`, `lastRollBounceSpeed` (replace the 4 tumble fields).
- `roll.ts`: `startRoll(player, { source, impulse }, t)` (lock = min(maxLock, |impulse| · lockPerImpulse); impulse 0 hit → no roll), `reactToHit` (seam kept; `hard` → lock ≥ hardLockSeconds), `endRoll`, `isRolling`, `isRollLocked`, `releaseRoll(player, input)` (dash source, fire up → end), `bounceRoll` (restitution, no count), `tickRoll` (lock, rest exit, max time, spin and stand-up).
- Controller: rolling branch in `applyHorizontal` → `steerRoll` (ground: + g·gravityScale·tangent.y, − (rollingDecel + rollingDrag·|v|)·grip, steer toward runSpeed; air: steer only below runSpeed). Jump: blocked while locked; a jump ends the roll. Crouch: not while rolling. `bounceRoll` after ground walls too.
- Dive: `stepDives` takes optional `inputs`; travel timeout or glancing terrain end with fire held → idle + cooldown + `startRoll(dash)` keeping full speed.
- Render: `rotation += player.rollAngle` (replaces x-based roll); blobPose reads roll fields.

## Juice
| Moment | Tier | Sound | Visual |
|---|---|---|---|
| Roll bounce (was tumble bounce) | medium | `tumble-bounce` | squash wide, 3 px shake by speed, helmet kick (unchanged values) |
| Dash roll starts | light | soft `land` thud (crouch gain) | body spins with the ground speed |
| Roll ends at rest | light | soft `land` thud (crouch gain) | body turns back upright (stand-up) |
| Hit roll starts | — | covered by the hit rows | — |

## Phases
1. Acceptance test `src/features/player/services/roll.test.ts` (slope roll-down, continuous strength, exits) → red.
2. roll.ts + types + tunables + controller → green; renames through dive/combat/effects/sound/match/tests. Gate: `pnpm type-check`, targeted tests.
3. Dash-hold in dive + match wiring + dive test. Gate: dive tests.
4. Juice: sound cues + ledger, READMEs, GAME_JUICE. Gate: `pnpm lint`, `pnpm validate:*`, `pnpm arch:check`, targeted tests.

## Review
Weekday token budget: one self-review against the rules instead of the parallel lens fan-out (gap reported at Stop 2).
