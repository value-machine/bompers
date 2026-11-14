# sound

## Purpose

Game sound effects. After each frame the match hands sound a snapshot of the sim. Sound turns what changed into cues and plays them through Web Audio. Sound reads the sim and never writes to it. The audio identity, palette and prompt template are in `documentation/game/DESIGN_LANGUAGE.md` § 8.

## Structure

| Layer | Path | Purpose |
|-------|------|---------|
| Types | `types/sound.types.ts` | `SoundCue` (catalog sound ID, slot for pitch, gain), `SoundSnapshot` / `SoundPlayerSnapshot` (one frame), `SoundCursor` (what the reader remembers) |
| Services | `services/soundCues.ts` | `readSoundCues(cursor, frame)` → `{ cursor, cues }`. Pure. A `null` cursor is a fresh round and cues `round-start` |
| Services | `services/soundBank.ts` | `SOUND_FILES` (catalog sound ID → take URLs in `public/audio/sfx/`), `PLAYER_PITCH_SEMITONES`, `playbackRateFor(slot)`, `SOUND_MIX`, `DUCKING_SOUNDS`, `pickTakeIndex` |
| Services | `services/soundPlayer.ts` | `createSoundPlayer(window)`: master → SFX bus + music bus, lazy cached decoding, random take rotation, per-player pitch, explosion ducking, mute on M (remembered in localStorage), resume on first key or pointer press |
| API | `api/soundApi.ts` | Public seam |

What each cue comes from:

| Cue | Source |
|-----|--------|
| `jump` | `jumpCount` / `wallJumpCount` rises |
| `land` | `landCount` rises; gain scales with `lastLandingSpeed` |
| `tumble-bounce` | `tumbleBounceCount` rises |
| `dive-launch` | dive phase enters `travel` |
| `dive-impact` | `playerHit` with source `dive`, or a dive ending in a terrain bonk |
| `hit` | `playerHit` (rocket) |
| `elimination` | `playerEliminated` |
| `rocket-fire`, `explosion`, `pickup` | `rocketFired`, `explosion`, `pickupCollected` |
| material sound | `terrainDestroyed.soundId` (silent until the bank has a file for it) |
| `respawn` | a player comes back into play |
| `round-start`, `round-end` | a fresh round's first frame; round phase turns `ended` |

Hits and eliminations take the victim's pitch; actions (jump, fire, pickup) take the actor's pitch; explosions and round sounds are unpitched.

## Dependencies

- `features/combat` (event types) and `features/content-catalog` (sound IDs; the bank test checks every bank key is a catalog ID).
- Consumed by `match`: `services/soundSnapshot.ts` builds the frame and `hooks/useGameSession.ts` reads and plays cues once per rendered frame.

## Decisions

- Every sound ID is a content-catalog ID (kind `sound`), so levels and materials can name sounds. File paths stay in the bank because they are an engine detail, not level data (game-sound D1).
- Sounds that the sim does not emit as events come from the players' monotonic counters and phase changes, not from new sim events (game-sound D2).
- Spare takes the owner kept for later are in `public/audio/sfx/` but not in the bank: `dive-impact-spare-1…4` for future material collisions, and `elimination-spare-1…2` (game-sound D3).
- The music bus exists before there is music, so explosion ducking is already wired (game-sound D5).
