# Brief — Homing missiles (dodgeable)

Task: Homing missiles (dodgeable) · Lap: temp_job_homing-missiles · Harness: v0.45.0

## Problem

The owner wants a second sky-crate weapon: missiles that home in on an opponent but that a moving player can dodge, visibly different from rockets (missile and crate).

## Success check

A deterministic combat-sim test: a homing missile fired near a standing opponent hits them; the same shot against an opponent who sidesteps (runs perpendicular at `runSpeed` once the missile is close) misses and the missile explodes elsewhere — and the crate step drops a `homing-launcher` crate from a drop point that lists it.

## In scope

- New held weapon `homing-launcher` (ammo, cooldown, recoil) fired with the fire button; its projectile is a rocket of kind `homing` in the same `combat.rockets` list (same sweep, contact and `explode` path).
- Dodge rule (DECISIONS D2): target locked at launch (nearest opponent inside a forward cone, else none → flies straight), lock-on delay, limited turn rate, steering fuel, then straight flight until contact or lifetime; target eliminated → straight.
- Crates: a drop point's `itemIds` alternate via a crate-state counter; catalog item `homing-launcher`; the three shipped levels list both items.
- Kill zone: `outOfBoundsMargin` uses the largest recoil of all weapons.
- Projectile look per weapon-visuals spec: lilac shorter rounder hull, red seeker light blinking 6 Hz, curving lilac trail, fins in shooter colour.
- Crate look: `drawCrate` picks by `itemId`; homing crate = lilac ring + twin-pod mark (simple hook the weapon-visuals thread can replace).
- Docs: combat + collectibles READMEs, LEVEL_FORMAT item table.

## Out of scope

- Will NOT do: per-weapon helmet tube, HUD ammo bar colour — weapon-visuals thread.
- Will NOT do: new sound — `rocketFired` cue is reused (event gains `itemId`).
- Will NOT touch: rocket launcher behaviour/tunables; player renderer; HUD.

## Edges

| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| combat | fire → `fireRocket` → straight sweep → `explode` | `attacks.ts` per-weapon fire, `rockets.ts` kind/speed, new `homing.ts` steering, `weaponPickups.ts` ammo per item, `combatRenderer.ts` homing sprite | ride |
| collectibles | drop → launcher crate only | `weaponCrates.ts` item choice, `weaponCrateRenderer.ts` per-item look | ride |
| content-catalog | item `rocket-launcher` | add `homing-launcher` | ride |
| match | margin from rocket recoil | `matchRules.ts` `outOfBoundsMargin` | ride |
| shared | tunables | `combat.homing` section + types; `WeaponItemId` type | ride |
| level content | drops list `rocket-launcher` | `public/levels/*.html`, level-kit example | ride |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size

M — five feature areas ride plus tunables and level content; no refactor beyond a `kind` on rockets and a per-weapon spec lookup.
Cut into laps: none.

## Decisions

DECISIONS.md D1–D5.
