# Brief — Slower jumps and rocket recoil

Task: Slower jumps and rocket recoil (owner feedback round 2 § 3) · Lap: temp_job_jumps-and-recoil · Harness: v0.45.0

## Problem

Jumps rise and fall too fast to coordinate trick jumps, and firing a rocket has no physical kick on the shooter.

## Success check

At default tunables a full jump reaches the same apex (~250 units) but takes at least 20 % longer to reach it than at gravity 2200 / jump 1050, and firing a rocket changes the shooter's velocity by `combat.rocket.recoil` opposite to the aim, both proven by tests that read the tunables.

## In scope

- Lower `world.gravity`; rescale every gravity-coupled vertical speed so heights stay the same and only the tempo slows: `player.jumpSpeed`, `player.wallJumpSpeedY`, `world.maxFallSpeed`, `combat.explosion.impulse`, `dive.strikeLift`, `dive.attackerPop` (speeds × √(g'/g), heights unchanged).
- New tunable `combat.rocket.recoil`: on fire, shooter velocity −= aim × recoil; an upward kick un-grounds the shooter.
- Tests: hang-time / apex test in `playerController.test.ts`, recoil test in `combatSim.test.ts`.
- README seams/decisions in `player` and `combat`.

## Out of scope

- Will NOT do: new air-control model (air steering gets more time through the slower tempo; `airAccel` unchanged), crouch (queued lap).
- Will NOT touch: player renderer / pose (feet lap), bounds / kill logic (edge-kill lap), horizontal speeds (run, dive launch, wall-jump X), tumble threshold.

## Edges

| Feature area                            | Loop today                                             | Hook point                                                              | Ride / new                                       |
| --------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------ |
| shared/config + shared/types (tunables) | `DEFAULT_GAME_TUNABLES` → every sim system             | `world`, `player`, `combat`, `dive` values; `combat.rocket.recoil` type | ride — values + one field                        |
| combat                                  | fire press → `attacks.ts` → `fireRocket` spawns rocket | `fireRocket` writes shooter `vx`/`vy`                                   | ride — combat already writes velocity for blasts |
| player (tests only)                     | `stepPlayers` jump → gravity                           | test of hang time                                                       | ride                                             |
| match (added after open-map-edges #30 merged, orchestrator ask) | `killZoneOf` → `outOfBoundsMargin` from jump + blast | `outOfBoundsMargin` launch speed adds `combat.rocket.recoil` | ride — recoil stacks with a rocket jump, so the margin must include it |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size

S — tunables values, one combat function, two tests, two README lines.
Cut into laps: none

## Decisions

DECISIONS.md D1–D3.

## Plan (S)

1. Acceptance tests first (red): `playerController.test.ts` — default jump reaches ~250 units and takes ≥ 0.57 s to the apex (old pair: 0.48 s); `combatSim.test.ts` — a level shot sets shooter `vx` to −`recoil`; a down shot sets `vy` to −`recoil` and un-grounds.
2. Tunables: `world.gravity` 1400, `maxFallSpeed` 1120, `player.jumpSpeed` 840, `wallJumpSpeedY` 720, `combat.explosion.impulse` 1080, `dive.strikeLift` 256, `dive.attackerPop` 576 (× 0.8); new `combat.rocket.recoil` 200 (+ type).
3. `fireRocket` → `kickShooter(shooter, recoil)`.
4. Fold D1 → player README, D2 + D3 → combat README.
Gates: targeted tests, type-check, lint, `test:run`, arch, structure. Owner judges feel on the preview.
