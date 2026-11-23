# fixed-pickups

## Purpose

Pickups that sit fixed on a level's collectible points from the match start and come back after a respawn time: the **headbutt reset** (`dive-reset`, FEEDBACK_ROUND_2 § 2.3) and the **health pickup** (`health`, health-pickups lap). A player who touches one and can use it takes it; a player who can't (dive still charged, full health) passes through and it stays. Who can use one and what it gives is the match's call (dive's `refillDive`, combat's `healFighter`), so this feature knows nothing about dives or health. Sky drops (point orbs, weapon crates) stay in `collectibles`.

## Structure

| Layer    | Path                                 | Purpose                                                                                                                                                                                                   |
| -------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types    | `types/fixedPickups.types.ts`        | `FixedPickupItem`, `FixedPickup` (item, point, respawn timer, present seconds), `FixedPickupTaken`                                                                                                        |
| Services | `services/fixedPickups.ts`           | `createFixedPickups(points)`, `stepFixedPickups({ pickups, players, canTake, tunables, dt })` → taken this step; `fixedPickupRule` (touch box + respawn per item); one of each item per player per step |
| Services | `services/fixedPickupPhase.ts`       | The shared life cycle every look follows: present (pop-in), popping, regrowing ghost; `fixedPickupBob`                                                                                                   |
| Services | `services/diveRefillRenderer.ts`     | Headbutt reset look: aqua jelly bubble with a headbutt glyph, wobble, droplet pop                                                                                                                       |
| Services | `services/healthPickupRenderer.ts`   | Health pickup look: hard cherry candy heart with a cream plus, a stiff squash, snaps into shards and mini hearts                                                                                         |
| Services | `services/fixedPickupsRenderer.ts`   | The view layer: one sprite per pickup, drawn and placed by its item's look (`LOOKS` table)                                                                                                              |
| API      | `api/fixedPickupsApi.ts`             | The seam `match` uses                                                                                                                                                                                     |

## Dependencies

- `collectibles` (`firstToucher`, the one touch test every pickup shares), `level` (collectible points), `player` (`PlayerState`) through their `api/` files.
- Shared: `gameTunables` (`collectibles.diveRefill`, `collectibles.health`), `gamePalette` (`diveRefill`, `healthPickup`), `heartRenderer` (the game's heart), `easing`, `outlineWidth`, `displaySync`.
- Used by `match` (sim step 4 before the orbs, render layer beside the orbs).

## Decisions

- Split out of `collectibles` when the health pickup arrived (health-pickups D7): collectibles is the sky drops; its services layer was at its 10-file budget; both fixed pickups share one sim and one life cycle, so a new fixed pickup is one item id, one rule and one look.
- Headbutt reset decisions carry over unchanged: placed on the `collectible` role with `data-item="dive-reset"` (headbutt-reset D1), only a spent dive takes it (D2), back after 2.5 s (D3), the jelly bubble look (dive-reset-bubble D1).
- Health pickup (health-pickups D1–D5): `data-item="health"`, no format change; +1 chunk (`collectibles.health.heal`), never above max; a full-health blob passes through and it stays; back after 12 s; the hard candy heart look; the `pickup` take pitched by the collector, counted by combat's `healCounts`.
