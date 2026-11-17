# Decisions — shared-roll

| # | Decision | Alternatives | Why | By |
|---|---|---|---|---|
| D1 | "Dash" = the dive (GDD "Beuk", FEEDBACK_ROUND_2 "headbutten/dashen"); "dash button" = fire. Dash-roll only for unarmed players. | Add a new dash button | Only the dive dashes; a new button is a new mechanic not asked | owner (confirmed 2026-11-17: hold fire through the dive, no new button) |
| D2 | One roll state in the player feature (`roll.ts` replaces `tumble.ts`); the controller runs rolling motion. | Keep tumble + add a dash-roll path | Owner: one shared system; the bounce must live in the controller's collision (dive-headbutt D10) | owner request |
| D3 | Strength continuous: impulse → lock seconds (linear, clamped); no `minImpulse`; impulse 0 → no roll. | Tiers; threshold kept | Owner: scalable 0 → shove → flying; blast power already scales the impulse | owner request |
| D4 | Bounces by restitution until the impact is below `minBounceSpeed`; no bounce count. | Keep N bounces | Physical; strength follows speed | agent |
| D5 | Spin is sim state (`rollAngle`, ground speed / r) so the look matches the physics. | Render-only from x | Rolling down a hill must look like rolling | agent |
| D6 | Exits: rest after lock, jump after lock, release fire (dash-roll, on ground), respawn, max time. | Fixed duration only | Owner: clean exits (land, jump-out, stop) | owner request |
| D7 | `reactToHit` stays the seam (fire / goo hook in). Shooter's own blast still never rolls. | — | Keep blast code unchanged; rocket jumps stay in control | owner request |
| D8 | Sound id `tumble-bounce` kept; code names renamed to roll. | Rename the asset id | Asset ids are content names with files; code mechanism is renamed (F3) | agent |
