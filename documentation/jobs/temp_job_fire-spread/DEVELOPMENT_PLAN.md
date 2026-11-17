# Development plan: Fire b1 — torch and fire on terrain

## Summary

- **Goal:** a torch weapon lights cardboard; fire spreads through touching fuel on the terrain field, burns samples away, scorches earth, and is seen and heard.
- **Why:** owner fire rules (blast-power D4–D8, D18); owner recut D1 (b1 first).
- **Brief:** `BRIEF.md`
- **Size:** M
- **Acceptance test:** `src/features/fire/services/fireSim.test.ts` (spread speed, air gap, stone, earth, ice, burn-out) + `src/features/fire/services/torch.test.ts` (torch lights the first fuel along a ray, drains 3 s of fuel, pushes a blob in the cone).
- **Plan review:** Done 2026-11-17 (one merged-lens reviewer, weekday budget)
- **Scope / constraints:** no new dependency; sim deterministic and DOM-free; no new audio files (placeholders, D8).

## Phase overview

| Phase | Goal | Gate | Status |
|-------|------|------|--------|
| 1 | Catalog flags + slot fields; `torch` item and weapon id; tunables | type-check, catalog + level-kit tests | Done |
| 2 | Arena `burnOut(grid, samples)` | arena tests | Done |
| 3 | `features/fire` sim: ignite, spread, burn-out, scorch (acceptance) | fireSim tests | Done |
| 4 | Torch: combat spray mode + hook; fire `sprayTorch` (acceptance) | torch + combat tests | Done |
| 5 | Render + juice + sound placeholders; match wiring; start-arena drop | full test:run, lint, type-check | Done |
| 6 | Docs, READMEs, ledger | loop-check gates | Done |

## Conflict & compliance

- Rules: architecture (new feature `fire` = one bounded concept: fire on the field and the torch that starts it; cross-feature only through `api/` barrels), file-placement (`src/features/fire/{api,services,types}/`, README required), code-style (role names: `burnOut`, `ignite`, `stepFire`, `sprayTorch`, `MinHeap` → `shared/utils/minHeap.ts` only if a second user exists; else private to fireSim), testing (colocated, should…when), game-juice (new moments: torch spray, ignition, burn-out → ledger rows, tiers, sound + visual channel each).
- Feature budgets: combat services is at 10 files → no new combat files (spray mode in `attacks.ts` / `weapons.ts`); arena services at 10 → `burnOut` inside `terrainGrid.ts`; fire is new (≤ 10 per layer).
- Layers: fire → arena, combat (helmet point, fighter types), player through `api/`; combat gets a `sprayAttack` hook type (no import of fire); match wires both.

## Phases

### 1 — Data
- `MaterialEntry.burns` (cardboard true) and `.douses` (ice true), others false; `TerrainCellSlot` gets both from `pieceCellSlot`.
- Item `torch` (use `drop`); `WeaponItemId` + `weaponItems` add `torch`; palette weapon look (accent, `nozzle` tube) and `weaponTube` nozzle parts.
- Tunables: `fire { spreadSpeed: 40, burnSeconds: 1.5 }`; `combat.torch { ammo: 3 (fuel seconds), fireCooldown: 0, recoil: 0, length: 84, halfAngleDegrees: 18, rays: 7, push: 900 }`.
- Level kit sync (catalog export + prompt weapon list).

### 2 — Arena
- `burnOut(grid, samples: readonly number[]): ClearedCells`: each still-solid sample → empty (`writeSample`, distance −EDGE_EPSILON), tallied by look; then every solid sample near the box is bounded by its nearest empty one (generalise `exposeUnbreakable` to all solids for this caller) and air is re-measured. Exported via `arenaApi`.

### 3 — Fire sim (`features/fire/services/fireSim.ts`, types in `types/fire.types.ts`)
- State: `igniteAt` Float32Array (∞), a binary min-heap of pending `{ index, time }`, `burning` indices, `scorched` Uint8Array, `version` for the renderer.
- `ignite(fire, grid, { index, time })` lights a fuel sample (burns, not next to a douses sample) if earlier.
- `stepFire(fire, grid, now)`: pop due entries (skip stale / no-longer-fuel); light; push 8-neighbour fuel at t + step / spreadSpeed; mark non-fuel breakable neighbours scorched; burn out samples lit ≥ burnSeconds ago through `burnOut`; returns `ClearedCells` for the match's `terrainDestroyed` event.
- Grid resize safety: state is created per grid (match start).

### 4 — Torch
- combat: `weaponMode(itemId)`: `projectile` | `spray`; `weaponTunables` returns the shared `{ ammo, fireCooldown, recoil }` view for any weapon; `rocketKindOf` only for projectile ids. `stepAttacks`: spray weapons call `sprayAttack({ ctx, attacker, fighter, dt })` every step the button is held (fuel −= dt, dropped at 0); event `torchStarted` on a new press (sound / effects).
- fire `sprayTorch(fire, { terrain, players, attacker, tunables, now, dt })`: rays from the helmet over ±halfAngle; each marches half-sample steps to `length` and stops at the first solid sample, lighting it when fuel; other blobs within the cone get `v += aim · push · dt`; records the spray for the renderer.

### 5 — Render, juice, wiring
- `fireRenderer.ts`: flames on burning samples (flicker by time, explosion palette), scorch tint on scorched samples, the torch spray cone from the helmet; layer above terrain, under players.
- Juice ledger rows: torch spray (light tier: spray visual + `rocket-fire` placeholder on start), ignition (light: flame pop), burn-out (light: cardboard `terrainDestroyed` → dust + `thwap`, existing).
- match: fire state in `GameState`, `stepFire` after combat, `sprayAttack` wiring, burn-outs → `terrainDestroyed` events; renderer layer.
- `public/levels/start-arena.html`: `torch` added to a drop point's items.

### 6 — Docs
- fire README, combat / arena / content-catalog / match / collectibles READMEs, LEVEL_FORMAT (items), DESIGN_LANGUAGE (flames, nozzle), GAME_JUICE ledger, vision fire row (b1 / b2 split).

## Pattern & precedent

- Fire spread as arrival time over a grid graph (Dijkstra / fast-marching front) is the standard for grid fire (wildfire models, Noita-style cellular fire uses per-cell timers). Ray-fan cones for flamethrowers are common in 2D shooters. No material divergence.

## Review contract

- Rules pinned at review time; lenses: naming, rebel, scale, precedent, tests; rule compliance: architecture, code-style, testing, game-juice.
- Gates: type-check, test:run, lint (≤ main's warnings), arch:check, validate:*, level-kit:check.

## Amendments

These supersede the phase text where they differ.

| id | change | source |
|----|--------|--------|
| A1 | Burn-outs are applied in batches every `fire.burnOutInterval` (0.25 s, ≤ 0.25 s late) and each batch emits at most one `terrainDestroyed` per look; ignition has no per-sample sound or effect (only the torch spray start is a moment). Juice: no spam (game-juice rule). | plan-review (contract) |
| A2 | HUD ammo pills and their redraw key use `Math.ceil(ammo)` (fuel seconds drain as a fraction). | plan-review (contract) |
| A3 | `exposeUnbreakable` becomes `boundSolidsByNearestAir(grid, box, which: "unbreakable" \| "all")` (role name, F1/F3); burn-out upkeep runs per chunk group of removed samples, never on one union box. | plan-review (contract + scale) |
| A4 | Spread: lazy decrease-key heap (push only when the new time beats `igniteAt`, set at push), ties by index (deterministic); burning samples are a FIFO (constant burn time ⇒ ignition order). | plan-review (scale) |
| A5 | "Touching" = 8 neighbours, but a diagonal step counts only when one of its two orthogonal in-between samples is solid (no corner pinch across air); `canBurn` (fuel, no douses sample among its 8 neighbours) gates both ignition paths. | plan-review (tests) → loop-plan decision D9 |
| A6 | Torch push reaches only blobs a cone ray meets before terrain; bound √(2·push·length) ≈ 390 u/s < the blast's 1080, so the kill-zone margin stays covered. `torchStarted` fires when spraying starts (not on the press). | plan-review |
| A7 | Tests take numbers from `DEFAULT_GAME_TUNABLES`; added: corner pinch, diagonal ice, blast mid-burn, blast lights nothing, fire under a blob, pickup swap mid-spray, fuel reaching 0 (tolerance), eliminated holder, same-time determinism. | plan-review |

## Notes during development

- Build: `igniteAt` is a Float32Array, so heap times are rounded with `Math.fround` at push; otherwise the stale-entry check never matched and fire did not spread (caught by the acceptance tests).
- Build: sprays not renewed this step are dropped inside `stepFire` (no separate match call).
- Not built from the review list (A7): "fire under a blob falls next step" is covered by the slope-walking ground rule (no ground within reach → air), not a separate fire test; "pickup swap refills the torch" follows from `takeWeaponPickups` (full ammo on every pickup), unchanged.
- D8 (sound placeholders): no fire audio exists; spray start reuses `rocket-fire`, burn-out reuses cardboard's `thwap`. Proper torch hiss / crackle takes are an asset task (weekend or owner-approved generation), queued as a follow-up.
