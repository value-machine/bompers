# Brief: Game sound effects (lap `game-sound`)

**Problem.** The game is silent. A first batch of 13 SFX × 4 takes, made from one-line prompts with no length control, kept only a few takes. The owner asked for a palette-first process: words and materials first, then generation.

**Success check.** On the PR preview, every sim event in § 8's SFX set plays its picked sound: jump, land, tumble bounce, dive launch and impact, hit, elimination, rocket fire, explosion, pickup, respawn, round start and round end. Players are pitched P1 0 / P2 +2 / P3 −2 / P4 +4. Sounds with several takes rotate. M mutes, and the browser remembers it.

**Scope.**
- A palette in DESIGN_LANGUAGE § 8, chosen in a brief artifact.
- Test rounds the owner picked from.
- Post-processed files in `public/audio/sfx/`.
- Sound IDs in the content catalog, with the kit synced.
- A `features/sound` module (cue reader + Web Audio player), fed by the match per frame.

**Edges.**
- No music; the music bus exists only so explosion ducking is wired.
- No material sounds (`thud`, `crumble`); they stay silent.
- No volume slider beyond the M mute.
- `src/config/app-tasks.json` is left alone (orchestrator).

**Size.** S. One new feature with three services, one match service, and one hook wiring change.

**Process as run.** Brief artifact → test batch (28 takes, 96 credits) → round two after the owner's notes (30 takes, 96 credits) → picks → wiring. With the first batch (~900), the lap used about 1,090 of the ~3,000 credit budget.
