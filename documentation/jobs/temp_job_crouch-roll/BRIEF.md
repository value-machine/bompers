# Brief: crouch roll

Lap branch `claude/crouch-roll`, Model C, size **S**. Builds on `main` after PR #109 (crouch-sink) merges.

## Problem

Owner (verbatim): "when the player is crouching and then presses or wants to move left or right while crouching, that should initiate the roll left and or roll right. So crouch plus movement is roll as well, just like the roll after a dive."

Today crouch + left/right only turns the crouched blob (crouch D4). The roll (`src/features/player/services/roll.ts`) has two entries: hit and dash (fire held through a dive).

## Success check

On the ground, crouch held + left or right held starts the shared roll in that direction (same physics, spin, sound, steering, bounce, jump carry, dive carry, weapon sweep). Proven by controller tests (`playerController.test.ts`) and owner play on the preview.

## Scope

- A third roll source `crouch` through `startRoll` (no parallel roll). Hold button `crouch`: releasing crouch ends it, like letting go of fire ends a dash.
- Start speed: `max(ground speed along the direction, roll.crouchStartSpeed)`, set along the ground tangent (slopes).
- Level prompt line for the new tunable (`levelPromptAbilities.ts`).
- Juice: the existing "Dash roll starts" moment, widened to "Move roll starts (dash, crouch)"; no new moment.

## Edges (not in this lap)

- Crouch visuals (#109's pose), dive and roll physics numbers other than the new tunable, input mapping.

## Decisions (agent, from the code)

| # | Question | Pick | Why |
|---|----------|------|-----|
| R1 | Entry | grounded, crouch held, `moveX ≠ 0`, not rolling, `steerScale ≥ 1` (no dive / frozen), same step — no crouch frame first | "presses **or wants to move**": a held direction counts, so run + down rolls straight out of the run (slide into roll). Air down stays aim (crouch D3). |
| R2 | Start speed | new `roll.crouchStartSpeed = 500` (run 340, jump carry cap 600, dash 900); a faster run keeps its speed | From a standstill the roll's own steering (500 /s² toward run speed) would take ~0.7 s to get going; 500 coasts ~`rollCoast(500)` then holds ~200 with the stick held, like any roll. Below the 600 jump-carry cap so it is weaker than a dive dash. |
| R3 | Exit | release crouch → roll ends, blob stands with its speed; jump (unlocked) → jump with roll carry; fire unarmed → dive with roll carry; comes to rest (hit-roll rest rule) or `roll.maxSeconds` → back to crouch if still held (re-rolls if a direction is still held) | Mirrors the dash's hold-to-keep. A crouch roll at rest must not stay a frozen ball, so it takes the hit roll's rest exit. |
| R4 | Sound counter | `dashRollCount` → `moveRollCount` (dash + crouch starts), F3 naming pass | One counter for the one moment; the name no longer encodes its first caller. |
| R5 | Slopes / ice | nothing special: existing ball physics (gravity along the slope, grip × friction) | Same roll. |
| R6 | Hurt box while rolling | full (not crouched): `startRoll` already clears `crouching` | A roll is not a crouch; halved crouch damage does not apply. |
| R7 | Armed vs unarmed | **open — owner** (conflict with crouch D4) | see below |

## Open (owner)

R7 — conflicts with crouch D4 ("aim, fire and jump stay live while crouching; facing still turns"). If crouch + left/right always rolls, a crouched blob can no longer turn on the spot, and on keyboard (aim = move keys) a grounded blob can no longer aim diagonally down (down-left / down-right); the air keeps it. Options: roll always (recommended, literal request); roll only unarmed (armed keeps crouch-turn and down-diagonal aim).

## Plan (S)

1. Tests first in `playerController.test.ts`: standstill crouch + right → rolling right at ≥ `crouchStartSpeed`; run + crouch keeps run speed if faster; release crouch ends roll; at rest with crouch held → crouching; airborne crouch + right → no roll; jump out carries; dive-steered (`steerScale < 1`) → no roll.
2. `player.types.ts`: `RollSource` + `"crouch"`, `RollHoldButton` + `"crouch"`, rename counter.
3. `roll.ts`: `startRoll` counts move rolls; `releaseRoll` for any hold button; `atRest` for hit and crouch.
4. `playerController.ts`: `startCrouchRoll` before `updateCrouch` (ground frame for the tangent).
5. Tunables + types: `roll.crouchStartSpeed`; prompt line; GAME_JUICE row; player README (crouch + roll sections, crouch D4 superseded per R7).
6. Gates: targeted tests, `type-check`, `lint`, `arch:check`, `validate:structure`.
