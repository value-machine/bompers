# Brief — Beam clash

Task: beams react when they meet, fire × ice first · Lap: temp_job_beam-clash · Harness: v0.45.0

## Problem

A torch flame and a freeze ray pass through each other as if the other is not there, while ice and fire cancel everywhere else (ground, blobs).

## Success check

With a torch and a freeze ray spraying head-on for a second, a clash is recorded, the ray's holder does not burn, the torch's holder gathers no chill, and neither is pushed (`src/features/match/services/gameSim.test.ts`, "beam clash").

## In scope

- A beam-vs-beam rule in `src/shared/utils/beamClash.ts` next to `rayFan` (D2, D4): given this step's beams and their elements, how far each goes and where they clash.
- Fire × ice as the first pair: the "Steam wall" (D1).
- Steam at the meeting point; `steam-hiss` reused; a GAME_JUICE ledger row.

## Out of scope

- Will NOT do: same-element clashes (torch × torch, ray × ray) — they keep passing through (D2).
- Will NOT do: new sounds — reuse only.
- Will NOT do: the push (B), cut-through (C) or burst (D) from the options page.
- Will NOT touch: what each beam does to ground and blobs; `src/config/app-tasks.json`.

## Edges

| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| `shared/utils` | `castRayFan` marches each ray to terrain, collects bodies | `beamClash.ts`: the clash rule and the pair table; `rayDirections` exported | new — role-named |
| `shared/config`, `shared/types` (tunables) | `combat.torch`, `combat.freezeRay` | `combat.beamClash.thickness` | ride |
| `combat` | `stepAttacks` calls the `sprayAttack` hook per sprayer | resolves clashes first, passes `reach`, keeps `beamClashes`, draws the steam in its overlay | ride (D3) |
| `fire` (`torch.ts`) | `sprayTorch` casts, lights, pushes, records the spray | casts no further than `reach` | ride |
| `ice` (`freezeRay.ts`) | `sprayFreezeRay` casts, freezes, pushes, records the beam | casts no further than `reach` | ride |
| `match` | wires both into combat's `sprayAttack` | passes `reach` on; clash count to sound; clears clashes at round end | ride |
| `sound` | reads sprays, beams, counters | `world.beamClashes` → `steam-hiss` on the element rate limit | ride |
| `documentation/game` | GAME_JUICE ledger, DESIGN_LANGUAGE effects | one row each | ride |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size

S — one shared rule with its test, a pre-pass in combat, an optional argument in two spray services, one sound condition, one overlay effect.
Cut into laps: none.

## Plan (built)

1. Acceptance test: `gameSim.test.ts` "beam clash" (head-on torch × ray; same-element control).
2. `beamClash.ts` + `beamClash.test.ts` (head-on, beyond the torch's length, at an angle, graze, apart, wall between, same element, fewer than two).
3. Combat: `SPRAY_BEAM` (element + fan per spray weapon), `clashBeams` pre-pass in `stepAttacks`, `SprayStep.reach`, `CombatState.beamClashes`.
4. Fire / ice: `reach` argument. Match: pass it, sound count, round-end clear.
5. Sound: `beamClashes` → `steam-hiss`. Combat overlay: `drawClashSteam`.
6. READMEs (combat, fire, ice, match, sound), GAME_JUICE row, DESIGN_LANGUAGE row.

Juice: tier light; sound `steam-hiss` (existing, rate limit `SOUND_MIX.elementCueSeconds`); visual steam puffs; no shake, flash or hit-stop.

Cost per step: nothing unless two beams of reacting elements are within reach of each other; then about ten reach tries of at most ~450 point checks each. No per-frame state for the steam.

## Decisions

DECISIONS.md: D1–D5 closed.
