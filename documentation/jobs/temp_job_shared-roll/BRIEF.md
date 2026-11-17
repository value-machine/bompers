# Brief — Shared roll: dash-hold roll and hit tumble

Task: Shared roll: dash-hold roll and hit tumble · Lap: temp_job_shared-roll · Run: run:bompers-game-2 (thread `shared-roll`)

## Problem
Rolling exists only as the tumble hurt reaction (a fixed on/off threshold, a fixed bounce count, a render-only spin), so a blob never truly rolls — not down a hill, not on purpose — and weapons can't be tuned by how hard they launch.

## Success check
A blob put into the roll state on a 20° slope with zero speed is rolling downhill faster after 0.5 s; a hit with impulse 0 leaves the player unchanged, a small impulse gives a short roll and a large one a long airborne roll with bounces (roll strength rises monotonically with impulse, no threshold); holding fire through a dive's travel enters the same roll state, and releasing / jumping / coming to rest leaves it.

## In scope
- **One roll state** on `PlayerState` (player feature, `services/roll.ts`, replaces `tumble.ts`): entered by `reactToHit` (any attack: dive strike, blasts, later burn) and by the dash-hold; `startRoll(player, { impulse?, source })`.
- **Continuous strength:** the impulse magnitude sets the out-of-control time (`roll.lockPerImpulse`, clamped to `roll.maxLockSeconds`); impulse 0 → no roll; no `minImpulse` threshold. Blast power already scales the impulse (#44), so weapons tune by power.
- **Real rolling physics** in the controller while rolling: on the ground, gravity × sin θ along the contour (rolls downhill, slows uphill), rolling friction (`roll.rollingDecel`, × material grip so ice keeps it going), no run target, weak steering; in the air ballistic; terrain impacts bounce by restitution (no bounce count; dies out below `roll.minBounceSpeed`), losing speed along the surface. Spin = a sim `rollAngle` advanced by ground speed / radius (air keeps the last spin rate), read by the renderer (replaces the render-only `x / 1.6r` roll).
- **Exits:** comes to rest (speed below `roll.stopSpeed` on the ground after the lock), jump-out (jump press once the lock has run out: normal jump, roll ends), dash-roll: releasing fire on the ground ends it; respawn ends it; `roll.maxSeconds` safety cap.
- **Dash-hold:** a dive whose travel ends (timeout or glancing terrain) while fire is still held goes straight into the roll with its speed (no recovery); dive gets the held fire state from match.
- Remove duplicates: tumble bounce code, `tumbleBouncesLeft`, render-only tumble roll, `isTumbling` call sites → `isRolling`; counters renamed (`rollBounceCount`, `lastRollBounceSpeed`) through effects / sound / match.
- Juice per GAME_JUICE.md: roll start (light/medium by impulse), roll bounce (existing tumble-bounce tier, renamed moment; sound id `tumble-bounce` kept), roll rest/exit (light). Ledger rows updated.

## Out of scope
- Will NOT do: roll as an attack (rolling into someone deals no damage; body collisions still push) — deferred.
- Will NOT do: armed dash (only unarmed players dive, so only they dash-roll) — excluded; new rolling sound loop — deferred (weekend asset).
- Will NOT touch: blast code / `blastPower` (explosions keep calling `reactToHit`), dive launch / strike / bonk numbers, crouch, slope walking for non-rolling blobs.

## Edges
| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| player | tumble.ts + controller `bounceTumble`/`tickTumble`, renderer roll | `services/roll.ts` (new, replaces tumble.ts), controller motion branch while rolling, `playerApi` | new — the roll state + physics |
| dive | strike → `reactToHit`; travel end → recovery | travel end + held fire → `startRoll`; `isTumbling` → `isRolling` | ride |
| combat | explosions → `reactToHit(impulse)` | unchanged call; doc comment only | ride |
| match | gameSim wires dive; matchSound counters | pass held fire to `stepDives`; counter rename | ride |
| effects / sound | feelCues / soundCues tumble-bounce counters | rename fields | ride |
| shared config | `tumble` tunables, gameJuice | `roll` tunables replace `tumble` | ride |
| content-catalog + level kit | sound label "Tumble bounce" | label "Roll bounce" (id kept, D8); `pnpm level-kit:sync` regenerates `public/level-kit/v2` | ride — added in build (label only) |
| docs | GAME_JUICE ledger, player/dive READMEs | rows + decisions | ride |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size
M — player controller motion branch + new roll service, one dive hook, renames across 4 features, tunables, docs. Not cut: the dash-hold entry is ~one hook once the roll state exists.

## Decisions
DECISIONS.md D1–D7.
