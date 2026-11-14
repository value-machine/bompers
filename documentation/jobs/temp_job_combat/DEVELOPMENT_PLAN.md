# Development plan — combat

Brief: `BRIEF.md` · Decisions: `DECISIONS.md`

## Acceptance test (first, failing)

`src/features/combat/services/combatSim.test.ts`: no self-damage, exactly 1 chunk per hit, impulse direction / falloff, rocket-jump height gain over a full jump, no tunnelling at max speed (1-cell wall, player), clearCircle only on destructible + material event IDs, unarmed hook (D11); `combatState.test.ts`: zones, damage table incl. bounce-only config, protection, elimination (D10); pickup fall → land → collect → ammo runs out, invulnerability blocks damage, elimination event at 0.

## Phases

1. **Tunables, palette, arena.** `combat` section (+ type); palette effect colours (DESIGN_LANGUAGE § 1 Effects); `clearCircle` → `{ removed, byMaterial }` (arena tests updated). Gate: type-check, arena tests.
2. **Combat types + sim (TDD).** `types/combat.types.ts` (CombatState, FighterState, RocketState, PickupState, CombatEvent); `services/combatSim.ts` (`createCombatState`, `stepCombat`, `eliminateFighter`, `respawnFighter`, `isFighterEliminated`), split into `fighters`, `rockets`, `pickups`, `explosions` service files to stay under complexity limits. Gate: tests green, lint clean.
3. **Match wiring.** `GameState.combat`; step 3 `stepCombat`; step 4 respawns eliminated / out-of-bounds players through combat. Gate: gameSim tests.
4. **Render.** `services/combatRenderer.ts`: pickups, effects (explosion starburst from `explosion` events, 250 ms shrink), rockets + tubes, health overlay; `gameRenderer` orders terrain → pickups → effects → rockets → players → overlay. Gate: headless Chromium run (pickup, rocket jump, crater, hit).
5. **Docs.** combat README, match / arena / player README lines, ARCHITECTURE module map row + dependency direction.

## Pattern & precedent

Worms / Soldat-style rockets: swept projectile with sub-steps ≤ half a cell, radial impulse with linear falloff, self-impulse without self-damage (Quake rocket jump minus the damage). Event log with sequence numbers is the usual fixed-step sim → render / audio bridge.

## Conflict & compliance

No new dependency. New files only under `src/features/combat/` (api, services, types, README) — allowed by the features whitelist. Imports: combat → arena, level (types), player (api); match → combat. Only renderer files import Pixi. Feature budget: ≤ 10 files per layer.

## Check summary

- Gates: type-check, lint (0 errors; the 9 warnings predate the lap), `test:run` 150/150, build, validate:structure, feature-size, feature-docs, arch:check (no new violations).
- Acceptance tests: `combatSim.test.ts` 17/17 and `combatState.test.ts` 8/8; `gameSim.test.ts` adds out-of-bounds elimination and hit-elimination respawn.
- Scope change (D10–D11) applied after the first check: bash removed, `applyHit` + `unarmedAttack` hook added (in `combatState.ts` / `attacks.ts`; the services layer stays within its 10-file budget); gates re-run.
- Headless Chromium (placeholder level, keyboard P1): launcher drops at 3 s and lands on the dirt; P1 walks over it and gets the tube; S+F rocket-jumps ≈ 260 px up and leaves a crater; W+D+F blasts a corner off the right dirt plateau; F at P2 removes one chunk (pale pip) and the blast throws P2 off the edge → out of bounds → respawn with full health. No console errors from combat (one pre-existing Pixi warning from the player helmet drawing).
- Not verified: gamepad aiming, four players.
