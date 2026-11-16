# Development plan — weapon-visuals

Brief: `BRIEF.md` · Decisions: `DECISIONS.md` · Size M · Model C, branch `claude/weapon-visuals`

## Summary

| Field | Value |
|---|---|
| Acceptance tests | `src/shared/utils/weaponTube.test.ts`, `src/shared/utils/pillRow.test.ts` |
| Plan review | Done 2026-11-16 (see § Review) |
| Phases | 1 now (look table, shared tube geometry, crate, HUD ammo row, docs) · 2 after PR #32 (blob tube from the shared geometry, muzzle light) |

## Conflict & compliance

- **Recorded decisions touched:** DESIGN_LANGUAGE § 1 says "Weapon pickup crate `#fff4e2` with a `#8fd6ff` ring" and § 2 "Rocket tube: a rounded rect … on the helmet". Both stay true for the rocket; the doc gains a weapon-identity section saying the ring and tube are per weapon (D1, D5). § 7 player card grows from 70 to 86 high for the ammo row (D3). No conflict, extensions only.
- **Colours** live only in `gamePalette.ts` (its header rule): `weaponLooks[itemId] = { accent, tube }`, `fallbackWeaponLook`, mirroring `materialLooks` / `fallbackLook`. `pickupRing` is removed (only the crate used it; the accent replaces it).
- **Shared geometry** mirrors the emblem split: pure shape data in `src/shared/utils/weaponTube.ts` (`WeaponTubeShape`, `weaponTubeParts(shape, u)` → round-rect parts), the Pixi tracer in `src/shared/services/weaponTubeRenderer.ts` (`traceWeaponTube`). Both folders and file patterns already hold siblings (`playerEmblem.ts`, `emblemRenderer.ts`), so placement is valid.
- **Naming (code-style § Naming):** roles, not callers: `weaponTube*`, `pillRow`, `weaponLook`. Phase 1 leaves a second copy of the rocket tube geometry (`blobShapes.tubePath` + shared) because blobShapes is frozen until #32; the shared module carries an F2 marker naming the copy, and phase 2 removes it (blobShapes uses the shared parts).
- **Layers / imports:** collectibles, match and player import `@/shared/...` only; no new cross-feature imports. Combat is read-only (`fighter.weapon`, `attackCooldown`, `combat.rocket.fireCooldown`/`ammo`).
- **Max ammo source:** `tunables.combat.rocket.ammo` (the value `weaponPickups` grants). Only one weapon exists; when a second lands, its lap moves ammo per weapon (noted in the match README seam).
- **Tests:** pure modules get unit tests (TDD, testing rule: geometry / layout with clear inputs). Pixi drawing is validated on the preview (UI default).
- **READMEs:** collectibles (crate per weapon), match (ammo row), player (phase 2). DESIGN_LANGUAGE § 1, § 2, § 7 + new weapon-identity section.
- No database, auth, security or dependency impact.

## Phase 1 — look table, crate, HUD ammo row (now)

1. `gamePalette.ts`: `WeaponLook { accent: number; tube: WeaponTubeShape }`; `weaponLooks: { "rocket-launcher": { accent: 0x8fd6ff, tube: "capped" } }`; `fallbackWeaponLook`; `weaponLook(itemId)` own-key lookup with fallback. Remove `pickupRing`.
2. `shared/utils/weaponTube.ts`: `WeaponTubeShape = "capped"`; `weaponTubeParts(shape, u)` returns the tube and cap round rects of today's `tubePath` (same numbers), plus `muzzle` point (cap centre) for phase 2.
3. `shared/services/weaponTubeRenderer.ts`: `traceWeaponTube(g, parts)`.
4. `collectibles/weaponCrateRenderer.ts`: crate key `${id}:${itemId}:${step}`; ring in `weaponLook(itemId).accent`; ink tube silhouette from the shared parts, rotated −22°, centred in the ring (replaces the fixed ink bar).
5. `shared/utils/pillRow.ts`: `pillRow({ count, filled, width, gap })` → `{ x, w, filled }[]`, used by both the health and the ammo row (A4). `hudRenderer.ts`: card height 86; `ammo` Graphics redrawn only when `(itemId, ammo, max)` changes; pills `h 10`, radius 5, at `y 66`, filled = accent, empty = `healthLost`; hidden when unarmed.
6. Docs: DESIGN_LANGUAGE (§ 1 crate row, § 2 tube line, § 7 card, new § "Weapon identity" with the rocket/homing/flame plan and team helmets), collectibles + match READMEs.

Gate: `pnpm test:run src/shared/utils/weaponTube.test.ts src/shared/utils/pillRow.test.ts src/features/collectibles` · `pnpm type-check` · `pnpm lint` · `pnpm validate:structure` · `pnpm arch:check`.

## Phase 2 — blob tube + muzzle light (after PR #32 merges, orchestrator signals)

1. Rebase on main. `blobShapes.tubePath` → draws `weaponTubeParts(look.tube, u)` (remove the copy and the F2 marker).
2. `playerRenderer`: `armedIds` becomes `weapons: Map<id, { itemId; ready: number }>` (ready 0…1); tube shape per item; accent muzzle dot on the cap (no outline, inner detail § 3) with alpha `0.15 + 0.85 · ready`.
3. `match/gameRenderer`: build the map from fighters: `ready = 1 − attackCooldown / combat.rocket.fireCooldown` clamped.
4. Player README; DESIGN_LANGUAGE § 6 muzzle light line.

Gate: as phase 1 + `pnpm test:run src/features/player`.

## Review

Plan review 2026-11-16, merged lenses (naming + code-style, rebel + precedent, scale/modularity + architecture) run as one read-only pass to keep the weekday token budget: 6 findings, 3 contract (A1–A3), 3 advisory (Notes). No naming findings.

### Amendments

| id | source | change |
|----|--------|--------|
| A1 | plan-review | `shared/utils/weaponTube.ts` has one consumer in phase 1 (crate); the second consumer is the committed phase-2 blob tube (app-code § decision order). Kept in shared. |
| A2 | plan-review | `weaponLooks` is keyed by plain `string` item ids: shared must not import combat's `HeldWeapon`. Brief wording updated. |
| A3 | plan-review | F2 marker: the shared module names the copy; `blobShapes.tubePath` gets its marker removed-with-copy in phase 2, because `blobShapes` stays untouched while PR #32 (player renderer) is open, to avoid a merge conflict. |
| A4 | loop-build | Pre-commit `validate:feature-size`: `match/services` was at its 10-file budget. The pill layout moved to `shared/utils/pillRow.ts`, and the health chunks now use it too (two consumers), instead of raising the budget. |

### Notes during development

- Advisory: `gamePalette` imports the `WeaponTubeShape` type from `shared/utils/weaponTube` (type-only; no runtime cycle). Kept.
- Advisory: HUD reads max ammo through one `maxAmmoFor(itemId, tunables)` accessor, so the per-weapon ammo move touches one place.
- Precedent: per-weapon silhouette + matching pickup icon + ammo pips in the weapon colour is the common arena-shooter pattern (pickup shows the weapon, HUD shows ammo); D1 follows it.
