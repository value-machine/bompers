# Brief — Match rules, scoring and respawn

Task: Match rules, scoring and respawn · Lap: temp_job_match-rules · Base: `claude/combat` (PR #10)

## Problem

A round has a timer but no point: eliminations score nothing, there are no collectibles, a player respawns instantly at their own slot's spawn with no protection, and the round just stops at 0 with no winner (GDD § 5, § 6).

## Success check

Unit tests assert: the respawn point is the spawn whose nearest active opponent is farthest (ties → lowest index; no opponents → slot order); a kill credited to another slot gives `killPoints`, a knock-off within `combat.killCreditSeconds` of the last hit credits the hitter, a fall without a recent hitter costs `fallPenalty`; a touched orb gives `orbPoints` and disappears; orbs appear on schedule round-robin over the level's point-orb collectibles; an eliminated player is out of play for `respawnDelaySeconds`, then respawns with full health and `invulnerableUntil = now + spawnProtectionSeconds`, takes no damage before it and can still move and fire; at time 0 the round ends with the highest score as winner and ties listed as a draw. In the preview: timer card counts down, player cards show score and health, a blinking respawn, an orb pickup, and the winner banner with restart on jump.

## In scope

- `features/match`: match-rules system replacing step 4 (score events by `seq`, respawn queue, spawn choice, protection); round result (winners) at timer end; restart in the session hook; HUD (timer card, player cards, end banner) in `services/hudRenderer.ts`; control-hint colour fix in `GameView.tsx`.
- New `features/collectibles`: point-orb state, schedule, fall-to-point, touch to collect (returns who collected), render layer.
- Player renderer: an option for protected (blinking) players.
- Tunables: `match` (respawn delay, protection, restart lock, scoring) and a new `collectibles` section; palette: orb, HUD card colours.
- `PLACEHOLDER_LEVEL`: three point-orb collectible points.

## Out of scope

- Will NOT do: lobby/settings UI, moving launcher pickups out of combat, font loading, sounds, elimination droplets and other visual-pass effects.
- Will NOT touch: `app-tasks.json`, combat internals (only the documented `invulnerableUntil` hook and events).

## Edges

| Feature area   | Hook point                                                  | Ride / new          |
| -------------- | ----------------------------------------------------------- | ------------------- |
| match          | step 4, step 5, `GameState.match`, renderer HUD, session    | ride — seam for it  |
| collectibles   | `stepCollectibles`, collectibles view                       | new                 |
| combat         | `playerEliminated` events, `invulnerableUntil`, respawn API | ride (read only + documented field) |
| player         | `SyncPlayersOptions.protectedIds`                           | ride — small option |
| level          | placeholder collectibles                                    | ride — data         |
| shared config  | tunables, palette                                           | ride — own sections |

## Size

M — one small new feature, match rules + HUD, one player renderer option, config sections.
Cut into laps: none

## Decisions

DECISIONS.md D1…D7.
