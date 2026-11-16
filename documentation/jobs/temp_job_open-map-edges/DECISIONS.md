# Decisions — open-map-edges

| #   | Decision | Alternatives | Why |
| --- | -------- | ------------ | --- |
| D1  | Elimination stays on all four sides, but the side and top kill lines lie `outOfBoundsMargin` beyond `level.bounds`; the bottom stays lethal at the bounds. | Open sides and top (only the bottom kills) — built first, then reversed; keep the kill lines on the bounds | Owner correction (via orchestrator): "THAT'S FINE, JUST NEEDS TO BE FAR ENOUGH SO THAT YOU DON'T NOTICE EVEN WITH CHAINED JUMPS." |
| D1a | Margin = (jumpSpeed + explosion.impulse)² / gravity, with the match's effective gravity (engine × lobby × level). | A fixed number; the camera view size | The owner asked for a margin derived from movement: the fastest single launch (a jump plus a point-blank blast) climbs v²/2g; twice that leaves room for a second full launch chained on top, and equals the 45° flight range v²/g, so it covers sideways flights. Lower gravity widens it automatically (e.g. the jumps-and-recoil thread's 2200 → 1400). |
| D2  | No soft walls or return force. | Soft-wall push-back; teleport back | Past the sides there is no ground, so a player who drifts out steers back or falls below the bottom; the far kill lines only catch extreme flights. Reductive. |
| D3  | Rockets and weapon crates use the same kill zone (match passes it as their `bounds`); their own checks are unchanged. | Rockets ignore side/top edges; rockets vanish silently | A detonation on an edge near a player is the same "killed by the air"; at the kill-zone edge no player is near. One zone for every body. |
