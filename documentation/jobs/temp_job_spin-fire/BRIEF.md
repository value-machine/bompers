# Brief — spin-fire

Source: owner request (orchestrator thread, 2026-11-19): "When the player is rolling … explore fun alternatives that give more recognition to the character that is spinning." Size: **S**.

## Problem

While rolling, the barrel is drawn on the spinning body (it whirls), but every weapon fires from the upright helmet point along the stick aim. The spin has no effect on the shot, and the picture and the shot disagree.

## Success check

- While a blob rolls, the direction its held weapon fires (rockets, homing lock cone and recoil, torch and freeze-ray fans, beam clash) sweeps round in the roll's turning direction at the spin rate, capped at `roll.sweepTurnsPerSecond`. When the roll ends it is the stick aim again.
- Shots leave from the helmet point as the spinning body carries it (the helmet circles the body centre with `rollAngle`).
- The barrel is drawn along that same heading, so picture and shot agree (also on slopes and dive overlays).
- Dive direction and the eyes keep the stick aim.

## In scope

- Player: sweep state on `PlayerState`, advanced in the roll tick; `weaponAim(player)` on the player API.
- Combat: `helmetPoint` follows `rollAngle`; rockets, homing, recoil, beam clash use `weaponAim`.
- Fire / ice: torch, freeze ray and the pilot flame use `weaponAim`.
- Player renderer: barrel drawn at the weapon heading in world space.

## Out of scope

- Spin curl, wind-up burst (owner: D out; B needs a new beam model).
- New sounds or effects (a new sound needs its own options page).
- Beam model changes (rays stay straight, re-cast per step).

## Edges

| Area | Change |
|---|---|
| `shared/config/gameTunables`, `shared/types/gameTunables.types` | `roll.sweepTurnsPerSecond` |
| `player` | state field, roll tick, `weaponAim`, barrel placement, README |
| `combat` | `helmetPoint`, rockets, attacks, README |
| `fire`, `ice` | torch, freeze ray, pilot flame |

## Plan

Acceptance tests (fail first): `src/features/player/services/roll.test.ts` › "should sweep the weapon aim …" / "should aim … stick … after the roll"; `src/features/combat/services/combatSim.test.ts` › "should fire a rocket along the swept weapon aim when the shooter rolls".

Conflict & compliance: no new files outside existing feature services; imports stay downward (combat, fire, ice already import the player API). Game juice: the moment is the existing fire / spray moment (light tier), no new channel; the sweep itself is the visual. Naming: `weaponAim` (role: where held weapons point), `weaponSweep` state.

1. **Sim** — tunable; `weaponSweep` field + initial value; advance in `tickRoll` (sign of `rollSpin`, |rate| capped), 0 when not rolling; `weaponAim`. Gate: roll tests, type-check.
2. **Weapons** — `helmetPoint` rotated by `rollAngle` around the body centre; replace stick aim in rockets (dir, homing cone, recoil), `clashBeams`, torch, freeze ray, pilot flame. Gate: combat, fire, ice tests.
3. **Look** — barrel rotation = weapon heading minus the root's rotation. Gate: lint, type-check, one headless smoke (console only).
4. **Docs** — README lines (player, combat), DECISIONS. Gate: `validate:feature-docs`.

### Status

Phases 1–4 Done. Acceptance tests red on the old `rockets.ts` (rocket flew along (1, 0)), green after.

**Notes during development:** `helmetPoint` now turning with the roll also moves the burning-blob flames (`blobFireRenderer`) round with the helmet; they still lick upward. The barrel now ignores the slope lean and dive overlay turn (it points where the weapon fires). Headless smoke loaded the app with no console errors, but no armed roll was driven in a browser.

**Decisions made:** `weaponSweep` lives on `PlayerState` (roll owns it, wrapped like `rollAngle`); `weaponAim` is exported from the player API so combat, fire, ice and the renderer share one heading.
