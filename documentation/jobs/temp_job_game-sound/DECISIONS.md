# Decisions: game-sound

- **D1** Every SFX is a content-catalog sound ID, so levels and materials can name sounds. File paths and takes stay in `features/sound/services/soundBank.ts`: they are an engine detail, not level data.
- **D2** Sounds the sim does not emit as events come from existing monotonic player counters (`jumpCount`, `wallJumpCount`, `landCount`, `tumbleBounceCount`), dive phase changes, the respawn queue and the round phase. Sound reads; the sim is unchanged.
- **D3** The owner's spare takes are kept in `public/audio/sfx/` but not wired: `dive-impact-spare-1…4` (for future material-specific collisions) and `elimination-spare-1…2`.
- **D4** `public/audio/sfx/` was added to `projectStructure.config.cjs`, approved by the orchestrator under the owner's delegation.
- **D5** A music bus exists before there is music, so explosion ducking (−4 dB, 300 ms) is already wired.
- **D6** Prompt rule from the test batch: never use "toy" (it adds squeaks). Only `eleven_text_to_sound_v2` is available in this account's region.
- **D7** Hits and eliminations take the victim's pitch; actions take the actor's; explosions and round sounds are unpitched.
- **D8** Level warnings are now logged on every round start, including rematches, because round setup (state, sound reset, renderer) lives in one `startRound`.
