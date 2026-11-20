# Decisions — gamepad-audio-unlock

- **D1 (owner, 2026-11-20):** the hint is option B, a small chip in the top-right reading "Tap for sound" (muted-speaker icon, card fill, ink outline, pill). Picked on the options page via the orchestrator.
- **D2 (orchestrator):** the chip is one reusable sound-status chip in the sound feature (`SoundStatusChip`), not gamepad-specific, so the mute indicator can reuse it or share its spot.
- **D3 (agent):** gamepads are polled (every 100 ms) only while the context is suspended; a press calls `resume()`, and if the context is still suspended 400 ms later the hint shows. Polling stops once the context runs.
- **D4 (orchestrator, architecture rule):** the sound feature went over its services budget; music moved to its own `music` feature (refactor commit) instead of a budget waiver.
- **D5 (owner via orchestrator + mute thread):** the chip takes a `status` (`blocked` now; the mute lap adds `muted`, which wins), and one wrapper places it: top-right in the lobby, bottom-right in a match so it stays clear of the HUD player cards.
