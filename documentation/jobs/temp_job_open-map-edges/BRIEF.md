# Brief — Side and top map edges stop killing players

Task: owner feedback round 2 § 3 · Lap: temp_job_open-map-edges · Harness: v0.45.0

## Problem

Players are eliminated the moment their centre crosses the side or top edge of `level.bounds` ("murdered by the air"), and rockets detonate on that invisible box; only falling off the bottom should be lethal.

## Success check

A player far left, far right or far above `level.bounds` stays in play; a player below the bounds bottom is eliminated (cause `out-of-bounds`) and respawns.

## In scope

- One out-of-bounds rule: only the bottom edge of `bounds` is lethal (players, rockets, weapon crates).
- Rockets no longer explode on the side/top edges; they fly on until terrain, a player, the bottom or `maxLifetime` (4 s).
- Docs: vision "Falling off the map" row, LEVEL_FORMAT `bounds` row, match + level + combat + collectibles READMEs.

## Out of scope

- Will NOT do: soft walls / push-back at the sides — gravity always returns a player, and beyond the sides there is no ground, so a player who drifts out must steer back or falls below the bottom (D2).
- Will NOT touch: camera (hard containment already keeps every player on screen past the bounds clamp), level format structure, jump/rocket physics.

## Edges

| Feature area | Loop today                                              | Hook point                             | Ride / new                                      |
| ------------ | ------------------------------------------------------- | -------------------------------------- | ----------------------------------------------- |
| shared/utils | —                                                       | new `outOfBounds.ts` (`isOutOfBounds`) | new — one rule, three consumers (code-style F2) |
| match        | `matchRules.eliminateOutOfBounds` → `isOutside` 4 sides | swap to `isOutOfBounds`                | ride                                            |
| combat       | `rockets.touchesSomething` → `!rectContains(bounds)`    | swap to `isOutOfBounds`                | ride                                            |
| collectibles | `weaponCrates` removes below or beside                  | swap to `isOutOfBounds`                | ride                                            |
| level / docs | README + LEVEL_FORMAT say "leaving it eliminates"       | wording only                           | ride                                            |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size

S — one shared predicate, three call-site swaps, tests and doc lines.
Cut into laps: none

## Decisions

DECISIONS.md D1–D3. Recorded-decision conflict: vision "Falling off the map" row — the owner's feedback overrides it; the row is rewritten.
