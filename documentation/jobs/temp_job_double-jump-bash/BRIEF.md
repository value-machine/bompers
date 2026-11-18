# Brief — Double jump that bashes

Task: owner request 2026-11-18 via orchestrator ("making the bash also for a double jump … now armed players can also bash") · Lap: temp_job_double-jump-bash · Harness: v0.45.0

## Problem
The bash (dive headbutt) starts only from fire, and an armed player's fire shoots, so armed players have no melee; the owner wants a mid-air jump press to bash so every player can.

## Success check
An armed player in the air (no ground within the landing buffer, no wall contact, out of coyote time) who presses jump starts the dive along its 16-way stick aim (straight up with no stick), it hits like a fire-started dive (same strike, damage, ricochet), and the shared one-per-airtime charge and cooldown block a second air move until it returns; ground, coyote, buffered-landing and wall jumps are unchanged.

## In scope
- A mid-air jump press that the controller does not use (not ground, coyote, wall or a landing buffer) starts the dive, for armed and unarmed players.
- Owner pick A (D1): the exact same dive (16-way stick aim, neutral = straight up, shared charge, cooldown, reset pickup), including the dash-hold roll, which then lasts while jump is held (D5).
- The controller reports an unused air jump press as a generic counter on `PlayerState`; the dive reads it (no dive branch in the controller, dive-headbutt D2).
- README decision rows in `dive` and `player`; GAME_JUICE ledger row if the start moment differs from the fire-dive launch.

## Out of scope
- Will NOT do: a second, separate air jump that does not bash; per-weapon melee; a new sound (the dive's `dive-launch` serves) — excluded.
- Will NOT touch: fire-button dive for unarmed players, ground / coyote / wall jumps, the jump buffer on landing, the ice block's crack presses (frozen inputs are already emptied), the dash-hold roll of a fire-started dive — unchanged.

## Edges
| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| player (controller) | jump press → buffer → ground / coyote / wall jump; an air press with none of those just expires in the buffer | `applyJump` / `readJumpButton`: count an unused air press (`airJumpPressCount`) when no ground is within buffer reach | ride — generic event counter, like `jumpCount` |
| dive | combat's `unarmedAttack` → `requestDive` → wind-up → travel → recovery; one charge per airtime | `stepDives` reads the new counter (via the players it already gets) as a second request source | ride |
| combat | armed press → fire; unarmed press → `unarmedAttack` hook | none | ride — unchanged |
| match (gameSim) | wires combat hook → `requestDive` | none in code; acceptance test + README row | ride |
| ice (frozen blobs) | `frozenInputs` empties a frozen blob's jump for the controller | none: no press reaches the controller, so no bash | ride — verify by test |
| movers | leaving a part (jump, dive) inherits its velocity once | none | ride |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size
S — two features (player counter + roll hold button, dive request source + trigger), tests in both, README rows.
Cut into laps: none.

## Overlap
Another thread is fixing a sim contact flip in `playerController.ts` ("Bug: collision sound retriggers"). Do not edit the controller until the orchestrator says that fix has merged; then rebase on main first.

## Options page
https://claude.ai/artifact/So7eXwag1Ayp5THxSWtk9j (A Jump dive · B Bash jump · C Up bash; recommended A). Sent to the owner via the orchestrator 2026-11-18.

## Plan (S)

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

## Decisions
`DECISIONS.md` D1–D9; D1 owner pick A, D5 roll on held jump (owner).
