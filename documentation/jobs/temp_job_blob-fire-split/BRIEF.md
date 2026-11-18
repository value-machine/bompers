# Brief — Split blob fire out of the fire feature

Task: the fire feature is at its file budget and holds two domain concepts; split burning blobs out so the mover-materials laps can go on (orchestrator, 2026-11-18) · Lap: temp_job_blob-fire-split · Harness: v0.45.0

## Problem

`fire` holds fire on the ground (per body, the torch, its layers) and blobs on fire (catch, burn, pass on, go out, their look). Its `services` layer is at the budget of 10 files, so lap 2a had to fold new tests into existing files, and lap 3 cannot add anything.

## Success check

Behaviour is unchanged: every existing fire, burning-blob and match test passes with only its imports and state accessors changed. `fire/services` holds 7 files, the new `blob-fire/services` 3; `pnpm validate:feature-size` and `pnpm arch:check` pass with no cycle between the two features.

## In scope

- New feature `src/features/blob-fire/`: `burningBlobs` (+ test), `blobFireRenderer`, their types and state slice (`BlobFireState`, `GameState.blobFire`), API, README.
- `fire`: the torch returns the blobs its flame reached instead of lighting them; the fire renderer no longer draws blobs.
- `match`: wires the new slice, the torch's reached blobs, the new layer, the sound counters.

## Out of scope

- Will NOT do: any behaviour, tunable, look or sound change; moving `fire.blob` tunables.
- Will NOT touch: the player controller and roll; `src/config/app-tasks.json`.

## Edges

| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| `blob-fire` | Not found | the moved files, state and API | new — one domain (blobs on fire) |
| `fire` | holds blob state and calls `catchFire` from the torch | `sprayTorch` returns reached blobs; state and renderer lose the blob parts | ride |
| `match` | reads `state.fire` for blobs | `state.blobFire`; torch hook; render layer; sound | ride |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size

S.

## Plan

Conflict & compliance: architecture § Feature granularity (two concepts → split); no cross-feature cycle (`blob-fire` → `fire` api, type only; `fire` never imports `blob-fire`); file-placement (a feature folder with `README.md`); code-style F4 (references to the moved files in READMEs updated). Acceptance test: the existing suites (no new behaviour).

1. Move the three files with `git mv`; new types file and API; `createBlobFireState`.
2. `fire`: drop blob fields from `FireState`, `sprayTorch` returns the reached blobs, renderer drops the blob layer.
3. `match`: state slice, torch hook (`catchFire` for each reached blob, lit by the holder), step 3d args, render layer, sound.
4. Tests follow: accessors and imports; the "blob on a burning part" case moves with the blob tests; READMEs.

Gate: type-check, lint, arch:check, validate:structure, validate:feature-size, full test run.

## Decisions

- D1 (closed, orchestrator 2026-11-18): do the split as its own small PR before lap 2b.
- D2 (closed, loop-plan, clear winner): the torch returns the blobs it reached and the match lights them, as the freeze ray's chill is wired, so `fire` does not import `blob-fire`.
- D3 (closed, loop-plan): `fire.blob` tunables and `gamePalette.fire` keep their names; renaming them is churn with no gain.
