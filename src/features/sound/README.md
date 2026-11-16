# sound

## Purpose

Game audio: sound effects, music and the player's sound settings. After each frame the match hands sound a snapshot of the sim. Sound turns what changed into cues and plays them through Web Audio. Sound reads the sim and never writes to it. One audio engine lives for the whole app, so music carries from the lobby into a match and explosions duck it. The audio identity, palette and prompt template are in `documentation/game/DESIGN_LANGUAGE.md` § 8.

## Structure

| Layer    | Path                        | Purpose                                                                                                                                                                                                                                                                                                                    |
| -------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types    | `types/sound.types.ts`      | `SoundCue` (catalog sound ID, slot for pitch, gain), `SoundSnapshot` / `SoundPlayerSnapshot` (one frame), `SoundCursor` (what the reader remembers)                                                                                                                                                                        |
| Services | `services/soundCues.ts`     | `readSoundCues(cursor, frame)` → `{ cursor, cues }`. Pure. A `null` cursor is a fresh round and cues `round-start`                                                                                                                                                                                                         |
| Services | `services/soundBank.ts`     | `SOUND_FILES` (catalog sound ID → take URLs in `public/audio/sfx/`), `PLAYER_PITCH_SEMITONES`, `playbackRateFor(slot)`, `SOUND_MIX`, `DUCKING_SOUNDS`, `pickTakeIndex`                                                                                                                                                     |
| Services | `services/audioEngine.ts`   | `createAudioEngine(window)`: master → SFX bus + (music duck → music bus), lazy cached decoding, warm-up of every file, random take rotation, per-player pitch, explosion ducking, settings store (`settings` / `updateSettings` / `subscribe`, localStorage), mute on M (remembered), resume on first key or pointer press |
| Services | `services/musicBank.ts`     | `MUSIC_TRACKS` (track → file in `public/audio/music/`, loop or once), `FINAL_MUSIC_SECONDS` (30), `musicTrackFor(round)`                                                                                                                                                                                                   |
| Services | `services/musicPlayer.ts`   | One track at a time, crossfade on change; the final piece starts at an offset so it lands on the round end                                                                                                                                                                                                                 |
| Services | `services/soundSettings.ts` | Defaults, `stepVolume` / `withVolumeStep` (tenths), `withChannelEnabled`, `busGains`, storage read / write with fallback                                                                                                                                                                                                   |
| Hooks    | `hooks/useAudioEngine.ts`   | `useAudioEngine()` (the app-lifetime engine), `useMusicTrack(track)` (plays while mounted), `useSoundSettings(engine)`                                                                                                                                                                                                     |
| API      | `api/soundApi.ts`           | Public seam                                                                                                                                                                                                                                                                                                                |

What each cue comes from:

| Cue                                  | Source                                                               |
| ------------------------------------ | -------------------------------------------------------------------- |
| `jump`                               | `jumpCount` / `wallJumpCount` rises                                  |
| `land`                               | `landCount` rises; gain scales with `lastLandingSpeed`. Also `crouchCount` rises, at `SOUND_MIX.crouchGain` (soft thud) |
| `tumble-bounce`                      | `tumbleBounceCount` rises                                            |
| `dive-launch`                        | dive phase enters `travel`                                           |
| `dive-impact`                        | `playerHit` with source `dive`, or a dive ending in a terrain bonk   |
| `hit`                                | `playerHit` (rocket)                                                 |
| `elimination`                        | `playerEliminated`                                                   |
| `rocket-fire`, `explosion`, `pickup` | `rocketFired`, `explosion`, `pickupCollected`                        |
| material sound                       | `terrainDestroyed.soundId`, and a dive bonk layers the bonked wall's material sound (`diveBonkSoundId`, unpitched) over `dive-impact`; silent until the bank has a file for it |
| `respawn`                            | a player comes back into play                                        |
| `round-start`, `round-end`           | a fresh round's first frame; round phase turns `ended`               |

Music: the lobby screen plays `lobby`; a round plays `match`, then `final` from 0:30 left, and fades out when the round ends (the round-end SFX plays). Leaving a screen fades its music out.

Settings for other screens (the pause menu): `engine.updateSettings((s) => withChannelEnabled(s, "music", false))` switches music off without losing its volume; `useSoundSettings(engine)` reads them. The lobby's Music and Sounds rows step the volumes.

Hits and eliminations take the victim's pitch; actions (jump, fire, pickup) take the actor's pitch; explosions and round sounds are unpitched.

## Dependencies

- `features/combat` (event types) and `features/content-catalog` (sound IDs; the bank test checks every bank key is a catalog ID).
- Consumed by `match` (`services/matchSound.ts` builds the frame, plays cues and picks the round's music; `hooks/useGameSession.ts` drives it once per rendered frame) and `lobby` (lobby music, volume rows).

## Decisions

- Every sound ID is a content-catalog ID (kind `sound`), so levels and materials can name sounds. File paths stay in the bank because they are an engine detail, not level data (game-sound D1).
- Sounds that the sim does not emit as events come from the players' monotonic counters and phase changes, not from new sim events (game-sound D2).
- Spare takes the owner kept for later are in `public/audio/sfx/` but not in the bank: `dive-impact-spare-1…4` for future material collisions, and `elimination-spare-1…2` (game-sound D3).
- The music bus exists before there is music, so explosion ducking is already wired (game-sound D5). Ducking now sits on its own node in front of the music bus, so it never fights the music volume (music D1).
- One audio engine for the app lifetime, not one per match: music carries across screens and both buses share one context (music D1).
- Sounds and Music volumes plus on/off switches per channel; M stays a master mute (music D2).
- The last 30 s of a round play a dedicated final piece, started in time with the clock (music D4).
- Music files are `lobby.mp3`, `match.mp3` (60 s loops, 32 bars at 128 BPM) and `final.mp3` (30 s, once) in `public/audio/music/`, one take each, processed as DESIGN_LANGUAGE § 8 describes; the bank test checks each track has its file.
