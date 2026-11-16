# Brief — Music

Task: Music · Lap: temp_job_music · Harness: v0.45.0

## Problem
The game has SFX but no music: the lobby and matches are flat, and the last 30 s of a match (owner feedback round 2 § 3) has nothing that builds tension.

## Success check
On the PR preview: the lobby plays the lobby loop; a match plays the match loop; at 0:30 left the music switches to the "final 30 s" piece, which lands at the round end; explosions duck the music (−4 dB / 300 ms); the lobby has Music and Sounds volume rows that change the levels at once and are remembered after a reload; M still mutes everything.

## In scope
- Generation (owner-guided, like game-sound): plan + credit estimate to the orchestrator first, small test batch, owner picks on an artifact, post-processed loops in `public/audio/music/`.
- One audio engine with app lifetime (one AudioContext: master → SFX bus + music bus), so music runs across lobby → match → lobby and explosions keep ducking the music bus. Today the context is per match session.
- Music player in `features/sound`: play a named track (loop or one-shot), crossfade between tracks, stop.
- Track choice: lobby screen → lobby loop; round playing → match loop; `remainingSeconds ≤ 30` → final piece; round ended → music fades out (the round-end SFX plays).
- Sound settings in `features/sound`: `sfxVolume`, `musicVolume` (0–1), `sfxEnabled`, `musicEnabled`, persisted in localStorage, with a small subscribe API the queued pause-menu lap can bind its on/off toggles to.
- Lobby menu rows: "Music" and "Sounds" volume steppers (0–10).

## Out of scope
- Will NOT do: pause-menu toggles (queued lap; it uses `musicEnabled` / `sfxEnabled`), material collision sounds (queued lap), per-level music.
- Will NOT do: extra stingers for round start / round end — the picked SFX already cover them.
- Will NOT touch: SFX cue reading, the picked SFX takes, terrain impact sounds.

## Edges
| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| `features/sound` | `createSoundPlayer` per match session; music bus wired, no tracks | engine lifetime, music player, settings store | ride — the owner of audio |
| `features/match` | `useGameSession` → `createMatchSound(window)` | take the shared engine; feed remaining seconds / phase to music | ride |
| `features/lobby` | `LOBBY_ROWS` level, loadFile, duration, gravity, start | two volume rows; lobby loop while shown | ride |
| `pages/GamePage.tsx` | switches lobby ↔ GameView | owns the engine for the page lifetime | ride |
| `public/audio/music/` | Not found | new music files | new — needs a whitelist line in `projectStructure.config.cjs` (protected, ask) |
| `documentation/game/DESIGN_LANGUAGE.md` § 8 | music line only | music palette, chosen takes | ride |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size
M — engine lifetime refactor across sound / match / page, a music player with crossfade, a settings store, two lobby rows, plus the generation rounds.
Cut into laps: none.

## Decisions
DECISIONS.md D1…D6.
