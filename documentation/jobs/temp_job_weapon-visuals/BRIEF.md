# Brief — Weapon and crate visual design system

Task: Weapon and crate visual design system · Lap: temp_job_weapon-visuals · Orchestrator run `run:bompers-game-2`

## Problem
Every crate shows the same rocket mark and every armed blob wears the same cream tube, so with homing missiles and the flamethrower coming, players on the couch cannot see what a crate holds, what a rival carries, or how many shots they have left.

## Success check
A per-weapon look table (keyed by the weapon item id string) drives the crate face, the helmet tube silhouette with its accent muzzle light, and a HUD ammo bar in the accent colour; adding a weapon's look entry is the only change needed for its crate, tube and ammo bar to differ from the rocket's.

## In scope
- **Weapon look table** in `src/shared/config/gamePalette.ts` (`weaponLooks[itemId]`: accent colour, tube shape id). Rocket entry only (accent sky `#8fd6ff`); the homing (lilac `#b58cff`) and flamethrower (ember `#ff8a1f`) entries land with those weapons. Design-language doc records the whole system, including the planned homing and flame looks.
- **Crates** (`collectibles`): crate face = the weapon's tube silhouette in ink inside an accent ring, from `crate.itemId`.
- **HUD** (`match` hudRenderer): an ammo bar directly under the health chunks, same pill design as health, in the weapon accent colour (one pill per shot left; lost pills pale). Hidden when unarmed. The accent colour itself tells the weapon.
- **Tube silhouette per weapon** (`player` blobShapes / playerRenderer, **after PR #32 merges**): tube shape from the look table (rocket = today's capped tube); the cap carries an accent **muzzle light** that fades out while a shot recharges (`attackCooldown / fireCooldown`) and is full when ready. No empty-weapon visual: the tube already disappears at 0 ammo (`attacks.ts` sets `weapon = null`).

## Out of scope
- Will NOT do: homing missiles, flamethrower, their projectiles, crates or tube shapes in code — deferred to their own laps (they add a look entry + shape).
- Will NOT do: team helmets (light vs dark shell) — deferred until a team mode exists (owner, D2).
- Will NOT do: helmet weapon badge icons (direction B) or colour-only coding (C) — excluded (owner, D1).
- Will NOT touch: player colours, emblems, health chunk behaviour, combat rules, ammo counts, crate drop/fall/pickup sim.

## Edges
| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| `shared/config/gamePalette` | `rocket`, `pickupCrate`, `pickupRing` constants | add `weaponLooks` keyed by itemId | new — one home for per-weapon look |
| `collectibles` | `weaponCrateRenderer.drawCrate` draws fixed ring + rocket bar | crate key/draw from `crate.itemId` | ride |
| `match` (hudRenderer, gameRenderer) | card: chip, label, 4 health pills, score; `armedIds` from fighters | ammo row under health pills from `fighter.weapon`; pass cooldown fraction to player view | ride |
| `player` (blobShapes, playerRenderer) | `tubePath` one shape; `armedIds` toggles tube | tube shape by itemId; muzzle light alpha per frame | ride — **waits for PR #32** |
| `combat` | `fighter.weapon`, `attackCooldown`, `weaponTunables` (ammo, fireCooldown per weapon) | read only; `combatApi` re-exports `weaponTunables` for the HUD | ride |
| `documentation/game/DESIGN_LANGUAGE.md` | § 1 effects palette, § 2 tube, § 7 HUD | add weapon identity section | ride |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size
M — four render edges (shared palette, collectibles, match HUD, player) plus the design-language doc; no sim change. Built in two phases: (1) look table + crate + HUD ammo bar + doc now; (2) tube shape + muzzle light after PR #32 merges.
Cut into laps: none (homing / flamethrower laps carry their own look entries).

## Decisions
DECISIONS.md D1–D5 (owner picks via orchestrator 2026-11-16); D6 open (homing projectile look, not blocking this lap).
