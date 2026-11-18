# Brief — Double jump that bashes

Task: owner request 2026-11-18 via orchestrator ("making the bash also for a double jump … now armed players can also bash") · Lap: temp_job_double-jump-bash · Harness: v0.45.0

## Problem
The bash (dive headbutt) starts only from fire, and an armed player's fire shoots, so armed players have no melee; the owner wants a mid-air jump press to bash so every player can.

## Success check
An armed player in the air (no ground within the landing buffer, no wall contact, out of coyote time) who presses jump starts the dive along the variant's direction rule, it hits like a fire-started dive (same strike, damage, ricochet), and the shared one-per-airtime charge and cooldown block a second air move until it returns; ground, coyote, buffered-landing and wall jumps are unchanged.

## In scope
- A mid-air jump press that the controller does not use (not ground, coyote, wall or a landing buffer) starts the dive, for armed and unarmed players.
- Direction rule, charge / cooldown sharing and height per the owner's pick on the options page (variants A / B / C, `OPTIONS.md` and the page).
- The controller reports an unused air jump press as a generic counter on `PlayerState`; the dive reads it (no dive branch in the controller, dive-headbutt D2).
- README decision rows in `dive` and `player`; GAME_JUICE ledger row if the start moment differs from the fire-dive launch.

## Out of scope
- Will NOT do: a second, separate air jump that does not bash; per-weapon melee; a new sound (the dive's `dive-launch` serves) — excluded.
- Will NOT touch: fire-button dive for unarmed players, ground / coyote / wall jumps, the jump buffer on landing, the ice block's crack presses (frozen inputs are already emptied), the dash-hold roll on fire — unchanged.

## Edges
| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| player (controller) | jump press → buffer → ground / coyote / wall jump; an air press with none of those just expires in the buffer | `applyJump` / `readJumpButton`: count an unused air press (`airJumpPressCount`) when no ground is within buffer reach | ride — generic event counter, like `jumpCount` |
| dive | combat's `unarmedAttack` → `requestDive` → wind-up → travel → recovery; one charge per airtime | `stepDives` reads the new counter (via the players it already gets) as a second request source | ride |
| combat | armed press → fire; unarmed press → `unarmedAttack` hook | none | ride — unchanged |
| match (gameSim) | wires combat hook → `requestDive` | none expected; maybe passes inputs already passed | ride |
| ice (frozen blobs) | `frozenInputs` empties a frozen blob's jump for the controller | none: no press reaches the controller, so no bash | ride — verify by test |
| movers | leaving a part (jump, dive) inherits its velocity once | none | ride |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size
S — two features (player counter, dive request source), tests in both, README rows. Variant B (separate charge, own upward launch) is the upper end of S.
Cut into laps: none.

## Overlap
Another thread is fixing a sim contact flip in `playerController.ts` ("Bug: collision sound retriggers"). Do not edit the controller until the orchestrator says that fix has merged; then rebase on main first.

## Options page
https://claude.ai/artifact/So7eXwag1Ayp5THxSWtk9j (A Jump dive · B Bash jump · C Up bash; recommended A). Sent to the owner via the orchestrator 2026-11-18.

## Decisions
`DECISIONS.md` D1–D8; D1 (variant) waits for the owner's pick on the options page.
