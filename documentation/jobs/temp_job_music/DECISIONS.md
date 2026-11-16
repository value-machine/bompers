# Decisions: music

- **D1** One app-lifetime audio engine (one AudioContext, master → SFX bus + music bus) instead of one per match session: music must survive lobby ↔ match, and ducking needs both buses in one context. Alternative (separate music context) loses the duck.
- **D2** "SFX volume" did not exist (only the M mute). This lap adds both: Sounds volume and Music volume, plus `sfxEnabled` / `musicEnabled` flags for the pause-menu lap. M stays a master mute.
- **D3** Volume rows live in the lobby menu (the only menu today). The pause-menu lap may show them too, through the same settings store.
- **D4** Last 30 s: a dedicated "final 30 s" piece starts at `remainingSeconds ≤ 30` and runs 30 s to the round end (rounds end only on the timer, `gameSim.roundTimer`). Alternatives: speed up the match loop (cheap, chipmunk pitch) or a stinger only (no build-up). Pending orchestrator / owner go with the credit plan.
- **D5** No extra round start / end stingers: the picked round-start and round-end SFX already play there.
- **D6** Music model `eleven_music_v2_5`, instrumental, via the ElevenLabs creative connector; prompts describe sound only (model guide).
