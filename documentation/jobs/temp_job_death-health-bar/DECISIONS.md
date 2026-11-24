# Decisions — death-health-bar

Owner feedback after #156: the health bar still shows on blobs that are knocked out or dying. On the final hit it should animate so it is clearly empty and the blob is dead.

| ID | Decision | Who | Status |
|----|----------|-----|--------|
| D0 | Root cause: the over-head bar is only updated for players in play. A knocked-out blob leaves that list, so its bar stayed frozen where it was hit, still showing the hearts from before the last hit, until the respawn. Fix: a bar whose player is out of play or eliminated hides until the respawn. | agent | Closed |
| D1 | Death animation: option C "Pop and scatter" from the three-option page (A pop, shake, crack was recommended; B pop and deflate). The owner first picked A, then changed the pick to C before it was built. The hearts still full pop out (1.3 → 0, 150 ms); then the empty row flies up and away like the hurt chunks, over `feel.hurt.chunkSeconds` (450 ms). Inside the `squash` and `linger` windows. No new sound. | owner, 2026-11-24 | Closed |
| D2 | One fly-off motion: the hurt chunks' flight moved from `effects` into `src/shared/utils/flyOff.ts` (`flyOffPose`, `flyOffAlpha`, `hashNoise`), and the bar's scatter uses it. Two consumers, one motion. | agent (naming F2) | Closed |
| D3 | HUD card unchanged: its last heart pops out and the row stays empty (grey) until the respawn refills it with the pop-in. | owner (as proposed) | Closed |
