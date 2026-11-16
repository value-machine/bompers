# Development plan — Homing missiles (dodgeable)

Brief: `BRIEF.md` · Decisions: `DECISIONS.md` · Size M (plan review lens: weekday token budget — one self-review against precedent, no fan-out).

## Acceptance test (first)

`src/features/combat/services/combatSim.test.ts` § "combat — homing missiles": curves into a standing opponent on an off-side aim (a plain rocket misses the same shot); misses an opponent who jumps when the missile is within 90 units; lock = nearest in cone; straight with no target; steering stops at fuel; homing ammo / cooldown / `rocketFired.kind`. `weaponCrates.test.ts`: a drop listing both weapons alternates them.

## Phases

1. **Sim** — `WeaponItemId` (shared types) + `isWeaponItemId` (shared config); `combat.homing` tunables; `RocketState.kind/targetId`; `weapons.ts` (per-weapon lookup + pickups, merged from `weaponPickups.ts` to stay within the services budget); homing guidance inside `rockets.ts`; `attacks.ts` fires the held weapon's kind; `outOfBoundsMargin` uses `maxWeaponRecoil`. Gate: combat + match tests.
2. **Crates + content** — crate item alternation; catalog item; level files list both; `pnpm level-kit:sync`. Gate: collectibles, level-file, content-catalog tests, `level-kit:check`.
3. **Look** — palette (`homing`, `pickupRingHoming`) + DESIGN_LANGUAGE rows; homing sprite (lilac hull, 6 Hz seeker, world-space curving trail); `drawCrate({ itemId })`. Gate: type-check, lint; owner judges the look on the preview.

## Pattern & precedent

Homing projectiles in arena shooters (Worms homing missile, Towerfall-style seekers) are made fair by a capped turn rate plus limited guidance time and a speed only moderately above player speed; lock-at-launch is the readable variant. Matches D2.

## Juice tiers (GAME_JUICE.md not on main yet)

Tier 1 (shipped here): blinking seeker light, curving trail. Tier 2 (left to weapon-visuals / juice lap): lock-on tell on the target, launch sound variant, per-weapon tube.
