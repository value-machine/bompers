# Development plan — blast-power

Brief: `BRIEF.md` · Decisions: `DECISIONS.md` · Size M · Base: `main` @ 4f2544f (material system #36 merged)

## Conflict & compliance

- **Recorded decisions touched:** material system D1/D3/D9 (catalog `destructible` flag, "unbreakable wins" overlap rule) → the flag becomes `toughness` (owner note on the #36 verdict: "we are changing the material destructibility, so it needs to match that new paradigm"); overlap rule keeps its meaning (unbreakable = `toughness: null`). Combat D7/D8 ("blast push radius and crater radius are separate tunables") → both now derive from one power (owner D1/D3 here); README lines rewritten.
- **Main moved since the brief:** `combat.explosion.impulse` is 1080 now (not 1350) and there are two blast weapons (rocket, homing). Per-power constants derive from main: push 1080 / 50 = 21.6 per power, reach 64 / 50 = 1.28, crater 34 / 50 = 0.68. Both weapons get `power: 50` (today they share one explosion).
- **Kept as is:** crouch damage halving in `applyHit` (#40), juice tiers (#34), `reactToHit` and `tumble.minImpulse`.
- **Placement:** pure power maths in `src/shared/utils/blastPower.ts` (+ colocated test; moved from combat during the build, D22); crater test in `src/features/arena/services/terrainGrid.ts`. No new folders; `pnpm validate:structure` per phase.
- **Naming (code-style § Naming):** `clearCircle` → `clearCrater` (role: the crater rule, not a circle helper); `destructible` / `durability` → `toughness`; `isBreakableSlot` helper replaces 7 copies of `slot.destructible === true` (F2: third copy → extract).
- **Layers:** combat → arena api (crater), content-catalog api (unchanged direction). Tunables types in `src/shared/types/gameTunables.types.ts`.
- **Testing:** TDD on `blastPower` and `clearCrater` (pure); existing combat / match / arena tests re-pointed to the new tunables, values unchanged at power 50.
- **Docs:** combat, arena, content-catalog, level-file READMEs; `LEVEL_FORMAT.md` § materials; kit regen (`pnpm level-kit:sync`) for `catalog.json` / `AUTHORING.md`; `DOC_APP_VISION.md` GDD-reading rows for blast power and the fire rules D4–D8.
- **Game juice:** no new moment; the explosion moment keeps tier heavy, its shake scale now reads this blast's reach against the rocket's reach (same value at power 50).

## Acceptance tests (written first, failing)

- `src/features/combat/services/blastPower.test.ts` — power 50 gives push 1080 / reach 64 / earth crater 34; 0 gives nothing; 10 and 90 scale linearly; push falls off to `minFalloff` and is 0 past reach.
- `src/features/arena/services/terrainGrid.test.ts` — `clearCrater` with reach 34 clears a wider span in cardboard (toughness 0.7) than in earth, nothing in stone or ice.

## Phases

### 1 · Power maths (TDD)
- Tunables: `combat.blast { pushPerPower: 21.6, reachPerPower: 1.28, craterPerPower: 0.68, minFalloff: 0.35 }` replaces `combat.explosion`; `power` on `combat.rocket` and `combat.homing` (and `ProjectileWeaponTunables`).
- `blastPower.ts`: `blastReach(t, power)`, `blastPushAt(t, power, distance)`, `craterReach(t, power)`, `maxBlastPush(t)` (strongest weapon, for the kill-zone margin).
- Gate: acceptance test green; `pnpm type-check` lists only the expected consumers.

### 2 · Toughness in catalog and terrain
- Catalog: `MaterialEntry.toughness: number | null` replaces `destructible` + `durability` (cardboard 0.7, earth 1, stone / ice null); kit export fact "toughness 0.7" / "unbreakable".
- Arena: slot `toughness`; `isBreakableSlot`; raster overlap rule; renderer / surfaces / tiles via the helper; `clearCrater(grid, { x, y, reach })` clears a breakable cell when `distance × toughness ≤ reach` (round; the distance rule the field lap reuses).
- Gate: arena + catalog + level-file tests green; `pnpm lint`.

### 3 · Blasts use power
- `Blast.power`; rockets pass `flightTunables(kind).power`; push / reach / crater from `blastPower`; `explosion` event `radius` = this blast's reach; renderer `fullBlastRadius` = rocket reach; kill-zone margin uses `maxBlastPush`.
- Gate: combat + match + effects tests green; `pnpm type-check`, `pnpm lint`, `pnpm arch:check`.

### 4 · Docs and kit
- READMEs, LEVEL_FORMAT, kit sync, vision rows (fold D1–D8, D18 note).
- Gate: `pnpm level-kit:check`, `pnpm validate:feature-docs`, `pnpm validate:structure`.

## Review

Plan review (size M) done as a single self-pass against the brief, rules and main's code (weekday token budget): applied A1 — derive per-power constants from main's current 1080 push, not the page's 1350; A2 — give the homing launcher a power too (it shares the explosion today).
