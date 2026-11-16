# Decisions — feet-animation

| # | Choice | Alternatives | Why |
|---|---|---|---|
| D1 | Foot motion (`FeetMotion`, `stepFeetMotion`) lives in `blobPose.ts` next to the helmet spring, applied by `placeFeet` | own `feetPose.ts`; inline in `playerRenderer.ts` | Pure + unit-tested like the helmet wobble; a new file breaks the player services budget (10 files) and raising the budget would absorb a violation (architecture rule) |
| D2 | Wall orientation reads existing sim fields (`wallDir`, `lastWallDir`, `wallJumpCount`, `wallJumpLockTimer`) | new sim "sliding" flag | Brief says render-only; airborne + wallDir ≠ 0 is the wall contact the slide/wall-jump already use |
| D3 | Feel numbers in `GameTunables.feel.feet` | module constants | Orchestrator: game-juice thread folds feel constants from the feel tunables |
| D4 | The pre-restyle renderer (before #23) also only lifted the feet; the "rotation and dynamics" are therefore designed fresh (swing arc, toe tilt, air tilt, spring splay) rather than restored | git-restore the old foot code | `git show 91488bd^:src/features/player/services/playerRenderer.ts`: `footLift` + `scale` only; body lean was the only rotation |
