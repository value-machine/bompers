# Brief — Crouch: hide under the helmet (sink + settle, low)

Task: owner request (orchestrator thread), not in app-tasks.json · Lap: temp_job_crouch-sink · Harness: v0.45.0

## Problem
The crouch squashes the helmet with the jelly body (1.18 × 0.68) so the hard shell looks soft, and at full crouch the body's top pokes about 1 u through the dome; it does not read as "a jelly blob hiding under a hard helmet".

## Success check
For every frame of a crouch (enter, hold, exit), no point of the drawn body outline at or above the helmet's rim line lies outside the helmet shape, the helmet keeps its standing shape (no crouch scale), the held body keeps ≥ 93 % of its standing area, the feet are gone while held, and a crouched blob's hurt box top sits `hurtHeightScale` × height above its feet so a rocket passing over it misses.

## In scope
- Owner pick (options page round 4, artifact UVQcoJwqL8UgJPKQEUFMvy): "3 · Sink + settle, low": rigid helmet sinks 12 u into the blob while the blob drops 15 u and presses ~4 u into the ground, spreading over it; upper half of the egg shortens so it fits inside the dome; jelly bulge under the rim keeps 94 % area; 2 u overshoot + settle wobble (350 ms); breathing while held; 3 u helmet hop on stand-up; feet vanish in the first 60 ms; eyes ride the face with the rim over their top half; body gloss slides left onto the bulge's upper-left arc.
- Hurt box moves down while crouched (owner): rockets, explosions, beams, homing aim and the weapon origin (helmet point) use the lowered height.
- Helmet glint reshaped slightly so it never comes near the dome's outline (owner).
- Juice ledger rows (crouch sink, stand up); land thud stays the sound.

## Out of scope
- Will NOT do: a new crouch sound — stays the `land` thud at `crouchGain`.
- Will NOT touch: crouch gameplay rules (damage ×0.5, chill ×0.5, burn tick skip, stand still), blob-to-blob body collision and terrain collision (`playerBody`), sky-drop pickups (another thread works on pickups; follow-up).
- Will NOT touch: the landing / jump squash of the helmet (only the crouch's own scale leaves it).

## Edges
| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| player (pose, shapes, renderer, controller, types, api) | crouch → `stepCrouchBlend` → `crouchScale` body scale + `crouchFace` | `blobPose.ts`, new `crouchPose.ts`, `blobShapes.ts`, `playerRenderer.ts`, `playerController.ts` (`hurtHeight`, `hurtBox`) | ride |
| combat (geometry, rockets, explosions) | `playerBody` / `bodyCenter` / `helmetPoint` use full height | swap to the hurt box | ride |
| shared rayFan | body circle at mid height, radius width / 2 | circle from the hurt height | ride |
| shared tunables + types | `player.crouch` render numbers | new sink/settle numbers + `hurtHeightScale` | ride |
| docs (GAME_JUICE ledger, player README) | crouch row missing / squash note | rows + README lines | ride |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size
M — five edges; new pure pose module with solved fit/bulge tables; renderer redraws the body outline while crouched; sim hurt box.
Cut into laps: follow-up "sky-drop pickups use the crouched hurt box" (after the pickups thread lands).

## Decisions
DECISIONS.md D1–D4.
