# Brief — Side and top map edges stop killing players

Task: owner feedback round 2 § 3 (+ owner correction) · Lap: temp_job_open-map-edges · Harness: v0.45.0

## Problem

Players are eliminated the moment their centre crosses the side or top edge of `level.bounds` ("murdered by the air"), and rockets detonate on that invisible box. The owner keeps elimination on all four sides, but the side and top kill lines must lie so far out that nobody notices them, even with chained jumps.

## Success check

A player well past the side or top edge of `level.bounds` (inside the margin) stays in play; a player past the side or top kill line is eliminated; a player below the bounds bottom is eliminated at once; a rocket flies on past the bounds top while inside the kill zone.

## In scope

- `killZoneOf(bounds, tunables)` in `match/services/matchRules.ts` (no new file: the services layer is at its 10-file budget): the level bounds grown on the left, right and top by `outOfBoundsMargin`, derived from movement tunables and the match's effective gravity; bottom unchanged.
- `GameState.killZone` computed once per match; elimination, rockets and weapon crates use it.
- Docs: vision "Falling off the map" row, LEVEL_FORMAT `bounds` row, match + level + collectibles READMEs.

## Out of scope

- Will NOT do: soft walls / push-back (D2).
- Will NOT touch: the out-of-bounds checks in combat and collectibles (they keep reading their `bounds`; match passes the kill zone), camera, level format structure, jump/rocket physics.

## Edges

| Feature area      | Loop today                                                  | Hook point                                                        | Ride / new                    |
| ----------------- | ----------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------- |
| match             | `matchRules.eliminateOutOfBounds` → `isOutside(level.bounds)` | `killZoneOf` in `matchRules.ts`; `GameState.killZone`; `killZone` arg | ride                          |
| combat            | `rockets.touchesSomething` → `!rectContains(ctx.bounds)`   | match passes the kill zone as `bounds` (comment only)             | ride                          |
| collectibles      | `weaponCrates` removes below or beside `bounds`              | match passes the kill zone as `bounds` (comment only)             | ride                          |
| level / docs      | README + LEVEL_FORMAT say "leaving it eliminates"            | wording only                                                      | ride                          |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size

S — one derived rect in match, three call sites pass it, tests and doc lines.
Cut into laps: none

## Decisions

DECISIONS.md D1–D3. Recorded-decision conflict: vision "Falling off the map" row — wording updated to the owner's correction.
