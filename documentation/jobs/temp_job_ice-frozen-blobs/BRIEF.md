# Brief — Ice lap 2: frozen blobs

Task: "Ice lap 2: frozen blobs" (backlog, via the orchestrator) · Lap: temp_job_ice-frozen-blobs · Harness: v0.45.0

## Problem
The freeze ray only pushes a blob it hits. The owner wants it to freeze the blob, with a way out through crouch, dive and jump.

## Success check
A blob held in a freeze ray for 0.5 s (1 s while crouching, never while diving) is frozen solid for 2.5 s: its inputs do nothing, it slides with almost no braking and can be shoved; three jump presses, a hit, the timer or fire end it.

## In scope
- Ice feature: blob chill and the ice block (state, rules, moments, counters), the block's look on the ray layer, the wide-eyed pose overlay.
- Freeze ray: chills the blobs it reaches.
- Fire feature: `douseBlob` (the ray puts a burning blob out; fire melts a block).
- Match: the wiring (inputs of a frozen blob, steps, hits shatter, fire and ice cancel), sound snapshot, renderer frame.
- Sound: placeholder cues for freeze, crack and shatter.
- Tunables `ice.blob`; docs: ice / fire / match READMEs, vision row, GAME_JUICE ledger.

## Out of scope
- Will NOT do: final ice sounds (the element-sounds thread), a block sliding down slopes by itself, freezing by frozen ground.
- Will NOT touch: the player controller (the block uses the existing `steerScale` and `jumpLocked` modifiers), lobby, level-file, drops, `src/config/app-tasks.json`.

## Edges
| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| ice | ray freezes ground, pushes blobs | `frozenBlobs.ts`, `blobIceRenderer.ts`, `sprayFreezeRay` chills | ride |
| fire | burning blobs, `putOut` inside the feature | exported `douseBlob` | ride |
| player | motion modifiers, `endRoll`, pose overlays | read only through `playerApi` | ride (no code change) |
| combat | `playerHit` events, `invulnerableUntil` | read only | ride (no code change) |
| match | sim steps, sound snapshot, renderer frame | new calls in `stepPlay`, snapshot counters, ice frame | ride |
| sound | counters → cues | three placeholder rules | ride |
| shared | `gameTunables` | `ice.blob` | ride |
| docs | READMEs, vision, GAME_JUICE | rows for the block | ride |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size
M — a new blob state with five ways out, wiring through the match step, a look, tests.
Cut into laps: none (sounds are the element-sounds thread's).

## Plan (short)
1. Tests first: `frozenBlobs.test.ts` (freeze after 0.5 s, sweep does nothing, crouch doubles it, a diving blob never freezes, inputs emptied, three presses break out, timer, grace, slides further than a free blob) and a match test (a dive hit shatters the block; fire and ice cancel).
2. Ice: types, `frozenBlobs.ts`, ray chills. Fire: `douseBlob`. Tunables.
3. Match wiring. Sound placeholders.
4. Look: `blobIceRenderer.ts`, frame wiring. Docs and ledger.

## Juice
| Moment | Tier | Sound | Visual |
|---|---|---|---|
| Frost building (held) | — | the ray's own cue | the block forming around the blob as the chill fills |
| Blob freezes | light | `clink` (placeholder) | white pop ring (effect window), then the block, wide eyes |
| Crack (jump press) | light | `clink` soft (placeholder) | a crack line on the block, a drawn 4-unit hop (squash window), chips |
| Block breaks (third press, a hit, time up) | light | `clink` (placeholder) | shards fly off (linger window) |
| Block melts (fire) | light | fire's douse `clink` | white steam puffs |

## Decisions
DECISIONS.md D1–D8.
