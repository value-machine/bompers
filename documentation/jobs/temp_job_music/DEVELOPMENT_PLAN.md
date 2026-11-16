# Development plan — Music (lap `music`)

Brief: `BRIEF.md` · Decisions: `DECISIONS.md` · Size M · Rules pinned at the commit printed by `git log -1 --format=%h -- .claude/rules` at plan time.

## Conflict & compliance
- Placement: new files only in allowed feature layers (`features/sound/{services,hooks,types}`), lobby services/components, `public/audio/music/` (needs a whitelist line in `projectStructure.config.cjs`; protected, asked via the orchestrator).
- Layers: pages → components → hooks → services. The engine (Web Audio, `window`) is created by a hook (`useAudioEngine`, app-lifetime singleton); services stay `window`-free and take a host.
- Cross-feature: lobby and match import sound only through `features/sound/api/soundApi.ts`.
- Recorded decisions: game-sound D5 (music bus + ducking) is kept, now on one shared context. No conflicts.
- READMEs: `features/sound`, `features/lobby`, `features/match` updated; DESIGN_LANGUAGE § 8 gets the music palette + chosen takes after the picks.
- Testing: pure services get unit tests (TDD); UI/Web Audio checked by one headless smoke run of the console + logged state.

## Pattern & precedent
Party games (Mario Kart final lap, Overcooked/Fall Guys final countdown) change the music for the final stretch: a faster, more intense cue. A dedicated final piece follows that precedent; speeding up the loop is the cheap variant. Music crossfades (~0.5–1 s) between screens, as is standard; game-wide SFX/Music volume sliders, kept separately, are the norm in settings menus.

## Acceptance test (first, failing)
`src/features/sound/services/musicBank.test.ts`: `musicTrackFor` gives `match` while playing with > 30 s left, `final` at ≤ 30 s, `null` once ended; `src/features/sound/services/soundSettings.test.ts`: bus gains follow volumes, enabled flags and mute; settings round-trip through storage and fall back to defaults on bad data. `src/features/lobby/services/lobbyMenu.test.ts`: the volume rows emit volume effects.

## Phases
1. **Settings + music bank (pure).** `types/sound.types.ts` (`SoundSettings`, `SoundChannel`, `MusicTrackId`), `services/soundSettings.ts` (defaults, read/write storage, `stepVolume`, `busGains`), `services/musicBank.ts` (`MUSIC_TRACKS`, `FINAL_MUSIC_SECONDS`, `musicTrackFor`). Gate: targeted tests, type-check.
2. **Engine.** Rename `soundPlayer.ts` → `audioEngine.ts` (`createAudioEngine(host)`): one context, mixer, loader, take picker, keys (resume + M), settings state with `subscribe`, `playCue`, `music.play(trackId | null)` with crossfade (`services/musicPlayer.ts`), bus gains from `busGains`. `hooks/useAudioEngine.ts` (app-lifetime singleton on `window`) + `hooks/useSoundSettings.ts` (`useSyncExternalStore`). Gate: type-check, lint, arch.
3. **Wiring.** `GamePage` gets the engine, passes it to lobby and `GameView`; lobby plays `lobby` while shown; `createMatchSound(engine)` plays cues and `music.play(musicTrackFor(round))` per frame; session dispose no longer closes the context. Gate: matchSound test, arch.
4. **Lobby volume rows.** `LOBBY_ROWS` + `music`, `sounds`; `LobbyEffect` adds `{ type: "volume", channel, step, wrap }`; `lobbyView` shows `0–10`; LobbyScreen carries the effect to `engine.updateSettings`. Gate: lobby tests.
5. **Music files.** After the go: generate, artifact, owner picks, post-process (loop-trim to whole bars, −16 LUFS, stereo mp3 128 kbps), drop in `public/audio/music/`. Gate: files load in the smoke run (no 404s).
6. **Docs.** READMEs, § 8, decisions.

## Review contract
Must-fix: no second AudioContext; no hooks in services; ducking still on the music bus; settings persisted with try/catch; pause-menu lap can read/write `musicEnabled` without touching lobby.
