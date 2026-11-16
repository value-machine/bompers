# Crouch: defensive stance

Source: owner feedback round 2 § 2.4 (`documentation/game/FEEDBACK_ROUND_2.md`).

## Problem

Holding down does nothing on the ground. The owner wants a defensive crouch: hold down → the blob stands still, sinks to the ground with its feet almost hidden, and takes half damage; 1-damage hits deal 0.

## Success check

- Grounded + down held: the blob stops (no walking), sinks (body squashed toward the ground) and the feet nearly vanish; release → it stands back up.
- While crouching every hit's damage is `floor(damage × 0.5)`: contact back 2 → 1, contact front 1 → 0, blast 1 → 0.
- Aim, fire, jump and the dive work as before (down + fire on the ground still aims down).

## In scope

- `PlayerInput.crouch` (keyboard down; gamepad d-pad down or left stick mostly down).
- `PlayerState.crouching` (+ `crouchCount` event counter) set by the controller: grounded, crouch held, not tumbling, steering not taken by an ability.
- Controller: while crouching the move input is ignored (velocity brakes to 0); facing still follows left / right so the blob can turn its front to an attacker. Jump leaves the crouch.
- Combat `applyHit`: one step scales the damage by `combat.crouchDamageScale` (0.5), floored.
- Render: crouch pose in `blobPose` (eased body squash + feet scaled almost to nothing), crouch-in sound cue.

## Out of scope

- Will NOT shrink the hitbox (crouch is a damage stance, not a duck under rockets).
- Will NOT change knockback / tumble (`reactToHit`) or touch the helmet tube in `playerRenderer`.
- Will NOT add crouch in the air (down in the air stays aim-down).

## Edges

| Area | Touch |
|---|---|
| `shared/types/gameInput.types.ts`, `shared/utils/gameInputMapping.ts` | `crouch` input field |
| `shared/config/gameTunables.ts` (+ types) | `player.crouch`, `combat.crouchDamageScale` |
| `features/player` | state, controller, blobPose, renderer pose apply only, README |
| `features/combat` | `applyHit` damage step, README |
| `features/sound` + `features/match/services/matchSound.ts` | crouch cue |

Size: **S**.
