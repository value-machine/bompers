# music

## Purpose

The game's music: which tracks exist, which one a round wants, and a player that crossfades between them. It plays through the audio engine of the `sound` feature, which owns the one AudioContext, the music bus, the volume and the explosion ducking. Musical identity: `documentation/game/DESIGN_LANGUAGE.md` § 8.

## Structure

| Layer    | Path                      | Purpose                                                                                                                                                                                                                        |
| -------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Types    | `types/music.types.ts`    | `MusicTrackId` (`lobby`, `match`, `final`)                                                                                                                                                                                     |
| Services | `services/musicBank.ts`   | `MUSIC_TRACKS` (track → file in `public/audio/music/`, loop or once), `FINAL_MUSIC_SECONDS` (30), `MUSIC_FADE_SECONDS`, `musicTrackFor(round)`                                                                                 |
| Services | `services/musicPlayer.ts` | One track at a time, crossfade on change; the final piece starts at an offset so it lands on the round end; `setPaused` holds the track at its position and continues it from there (game pause; a track change ends the hold) |
| API      | `api/musicApi.ts`         | Public seam                                                                                                                                                                                                                    |

Which track plays: the lobby screen plays `lobby` (`useMusicTrack` in `sound`); a round plays `match`, then `final` from 0:30 left, and fades out when the round ends (`match/services/matchSound.ts` with `musicTrackFor`).

## Dependencies

- None. Consumed by `sound` (the engine creates the player on its music bus and warms the files) and `match` (`musicTrackFor`, `FINAL_MUSIC_SECONDS`).

## Decisions

- Split out of `sound` (gamepad-audio-unlock lap): sound effects and music are two domain concepts, and the split kept `sound` inside its file budget. The engine stays in `sound` because both share one context (music D1).
- The last 30 s of a round play a dedicated final piece, started in time with the clock (music D4).
- Music files are `lobby.mp3`, `match.mp3` (60 s loops, 32 bars at 128 BPM) and `final.mp3` (30 s, once) in `public/audio/music/`, one take each, processed as DESIGN_LANGUAGE § 8 describes; the bank test checks each track has its file.
