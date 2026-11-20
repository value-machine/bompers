# Mute indicator — brief

**Problem:** M mutes all audio and the mute is saved in localStorage, but nothing on screen shows it. A muted player thinks the audio is broken (the owner's production scare).

**Owner picks (via orchestrator, 2026-11-20):**

- D1 Look: the muted state of the shared top-right **sound-status chip** (built by the gamepad-audio lap for "Tap for sound"): speaker-off icon, "Sound off", M key cap. Lobby and match, only while muted; click / tap unmutes. If top-right collides with the match HUD cards, low-right in a match only.
- D2 Keep remembering the mute across reloads (the chip makes it visible).
- D3 No menu row; chip only.
- D4 One chip component in the sound feature, two states (blocked, muted); muted wins when both hold.

**Success check:** with the mute on (M, or saved from an earlier visit), the chip shows in the lobby and in a match; tapping it or pressing M brings the sound back and hides the chip.

**Scope:** `features/sound` (engine notifies mute changes, `useMuted`, the chip's muted state); the lobby and match only through the chip.

**Edges:** no change to volumes, menus or the gamepad unlock itself.

**Size:** S. Depends on the gamepad-audio lap's chip (lands first; this lap adds the muted state on top).

## Plan

1. Engine: the settings store owns the mute, so `subscribe` fires on mute toggles; `useMuted(engine)`. Test: `services/audioEngine.test.ts`.
2. After the chip lands on `main`: rebase, add the muted state (muted wins), unmute on click / tap.
3. Feature README + DESIGN_LANGUAGE § 7 line for the chip state.
