# Development plan — headbutt-reset

Brief: `BRIEF.md` · Decisions: `DECISIONS.md` · Size M · Model C branch `claude/headbutt-reset`

## Conflict & compliance

- Placement: new `src/features/collectibles/services/diveResets.ts` (+ `.test.ts`) and `diveResetRenderer.ts` — services layer of an existing feature (allowed pattern). No new folders.
- Layers: collectibles imports no dive code; match wires `isDiveSpent` / `refillDive` (dive api) to the pickups (collectibles api), like crates → combat. Sound reads only a counter from the match snapshot.
- Naming (code-style § Naming): role names `diveReset` (pickup kind), `refillDive` (dive charge refill). The pickup is the second fixed-point pickup kind? No — orbs fall, crates fall; this is the first fixed one, so no extraction. Touch test reuses `skyDrops.firstToucher` (one copy).
- Feature budgets: collectibles services gets +3 files — run `pnpm validate:feature-size`.
- Catalog: additive `item` entry → `pnpm level-kit:sync` regenerates `catalog.json` and the LEVEL_FORMAT table.
- READMEs: collectibles, dive, content-catalog, sound, match (step 4 line).
- Testing: unit tests colocated; acceptance test `src/features/collectibles/services/diveResets.test.ts` + a gameSim integration test (`gameSim.test.ts`) that the refill reaches the dive.

## Pattern & precedent

Celeste dash-refill crystal / Ori: fixed point, refills one air dash, consumed only when the dash is spent, respawns after ~2.5 s, shows an outline while gone. Followed exactly (D2, D3).

## Phases

### Phase 1 — sim (acceptance test first)
1. `diveResets.test.ts` (failing): spent player takes it and gets `ResetCollected`; charged players are not passed in (match filters) — test that a pickup only reacts to the list it gets; respawn after `respawnSeconds`; one pickup per `dive-reset` point; non-`dive-reset` points ignored.
2. Types: `DiveResetPickup { pointIndex, x, y, respawnTimer, presentSeconds }`, `DiveResetCollected { slot, x, y }`; `CollectiblesState.diveResets`.
3. `diveResets.ts`: `createDiveResets(points)`, `stepDiveResets({ resets, players, tunables, dt })`.
4. Tunables `collectibles.diveReset: { respawnSeconds: 2.5, size: 26 }` (+ types).
5. Dive: `DiveMotion.refills`, `isDiveSpent`, `refillDive`; export via api; test in `diveSim.test.ts`.
6. Match `gameSim.ts` step 4: `stepDiveResets` with `playersInPlay(state).filter(p => isDiveSpent(state.dive, p))`, then `refillDive` for each collected. gameSim integration test.
Gate: `pnpm test:run` on touched tests, `pnpm type-check`.

### Phase 2 — catalog, levels, kit, sound
1. Catalog item `dive-reset` (`use: collectible`, label "Headbutt reset"); `pnpm level-kit:sync`.
2. Sound: `SoundPlayerSnapshot.diveRefillCount`; rule `pickup` on rise; snapshot in `matchSound.ts`; soundCues test.
3. Levels: add `dive-reset` points in `start-arena.html` and `floating-garden.html` in gaps between platforms (air routes).
4. Kit: `AUTHORING.md` + `preview.css/js` colour for `data-item="dive-reset"`; LEVEL_FORMAT § 6 role row note.
Gate: `pnpm level-kit:check` equivalent via tests, `pnpm validate:structure`, level-file parser test of a shipped level still clean.

### Phase 3 — look and juice
1. `gamePalette.diveReset` (aqua `#5fe0ff`), DESIGN_LANGUAGE § 1 Effects row.
2. `diveResetRenderer.ts`: diamond crystal, ink prop outline, gloss facet, up-chevron in ink; bob; pop-in scale (`squash` window, 150 ms) when it returns; burst ring (`effect` window, 220 ms) after taken; then ghost dashed-ish outline (alpha 0.35) until back. Layer: collectibles `resets` container placed beside `orbs` in `gameRenderer.ts`.
3. GAME_JUICE ledger rows: "Headbutt reset taken" (light, `pickup`, burst ring, —), "Headbutt reset returns" (—, —, pop-in).
Gate: `pnpm lint`, `pnpm type-check`, `pnpm arch:check`, `pnpm validate:feature-size`, one headless smoke run (console clean).

### Phase 4 — docs fold
READMEs (collectibles, dive, content-catalog, sound, match), DECISIONS folded.

## Review contract
Rules pinned at the commit of `.claude/rules` on main. Must-fixes become Amendments below.

## Amendments
Plan review (one merged lens, 8 findings, 3 must-fix):
- A1 (must-fix): `refillDive` waives the between-dives cooldown (D4 amended); `endDive` skips `cooldownSeconds` when the charge came back mid-dive.
- A2 (must-fix): refill counter lives in `DiveState.refillCounts`, not the motion (respawn replaces the motion).
- A3 (must-fix): `createCollectiblesState(tunables, points)` builds the refills (done in phase 1).
- A4: one refill per player per step. A5: `isDiveSpent` requires airborne. A7: code name `diveRefill*` (D7). A8: gameSim test for a charged pass-through; size is 30.
- A6 (format `use` mismatch warning in importer/kit): not built — `level` feature is outside the edges; AUTHORING says "never on drop". Follow-up candidate.
