# Decisions — mute-indicator

- **D1 (owner via orchestrator, 2026-11-20):** the mute is shown as the `muted` state of the shared sound-status chip: speaker-off icon, "Sound off" and an M key cap. It appears only while muted, and click or tap unmutes. Same spot as "Tap for sound": top-right in the lobby, bottom-right in a match (clear of the HUD player cards, gamepad-audio-unlock D5).
- **D2 (owner):** the mute stays remembered across reloads; the chip makes it visible.
- **D3 (owner):** chip only, no menu row.
- **D4 (owner + agent):** muted wins over blocked; a tap on the muted chip both unmutes and (via the engine's pointerdown resume) starts blocked sound.
- **D5 (agent):** the settings store owns the mute, so `engine.subscribe` fires on mute toggles and `useSoundStatus` reads it; no second store. The silent engine now remembers the mute too.
