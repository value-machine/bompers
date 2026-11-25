# Decisions — death-bar-follow

Owner feedback on #160: "I want the healthbar to keep following the helmet until the player has respawned. Currently I think it's stuck to the death position. Also the hearts should scatter in the same direction the player body moved at that time." Confirmed: the hearts scatter, then nothing shows. No empty bar stays afterwards.

| ID | Decision | Who | Status |
|----|----------|-----|--------|
| D1 | The dying row rides the knocked-out blob's head: the top of the flying, squashing or crushed body, then its loose helmet (`knockoutHeadPoints` in the knockout feature, passed by the match as `CombatFrame.knockoutHeads`). Each heart launches from where the head is when the hearts are knocked loose, then flies on by itself. A blob that falls off the arena has no knockout, so its hearts stay where it was last seen. | owner (ask), agent (mechanism) | Closed |
| D2 | Each heart inherits the body's velocity right after the lethal hit (the `playerEliminated` event's `vx`, `vy`), on top of the shared fan, gravity and spin. The speed is capped at `FLY_OFF.maxCarry` = 360 units/s, keeping the direction, so a huge knockback still keeps the hearts on screen for most of the 450 ms. A still knockout (crush, burn) keeps the upward fan. The hurt chunks pass no velocity and are unchanged. | owner (ask), agent (cap value) | Closed |
| D3 | After the scatter nothing shows until the respawn (unchanged from #160). | owner | Closed |
