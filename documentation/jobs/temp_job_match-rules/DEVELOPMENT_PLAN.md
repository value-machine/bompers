# Development plan — match-rules

Brief: `BRIEF.md` · Decisions: `DECISIONS.md` · Size M

## Acceptance test

`src/features/match/services/matchRules.test.ts`, `spawnChoice.test.ts`, `src/features/collectibles/services/collectiblesSim.test.ts` (the brief's success check), plus a headless Chromium run: HUD, respawn blink, orb, end banner, restart.

## Pattern & precedent

Respawn "farthest from the nearest enemy" is the standard arena-shooter rule (Quake/Unreal-style farthest spawn, Smash's respawn platform + invulnerability blink). Points for kills with a self-destruct penalty mirrors Smash's timed mode (SD = −1). Deterministic round-robin spawns instead of random ones keep the sim reproducible (combat D6).

## Conflict & compliance

- Combat D2 (point collectibles get their own feature) → new `features/collectibles`.
- Only `match` knows `GameState`; collectibles takes slices (game-engine-foundation D5).
- No package needed (spec-reuse-package: bespoke game logic).

## Phases

1. **Tunables + palette** — `match` (respawn, protection, restart lock, scoring), `collectibles` section; `pointOrb`, `hud` colours. Gate: type-check. ✅
2. **Collectibles feature** — types, sim (schedule, fall, collect), renderer, api, README, tests. Gate: tests. ✅
3. **Match rules** — `spawnChoice.ts`, `matchRules.ts` (out of bounds, scoring by seq, respawn queue, protection, winners, restart press), `gameSim` steps 4–6 and in-play filtering; tests. Gate: tests. ✅
4. **Render** — player protection blink option, `hudRenderer.ts`, collectibles layer, in-play-only drawing/camera, session restart, control-hint colour, placeholder collectibles. Gate: lint, arch, headless screenshots. ✅
5. **Docs** — match/player/level READMEs, ARCHITECTURE game module map. ✅

## Review contract

Gates: `pnpm type-check`, `pnpm lint` (no new warnings), `pnpm test:run`, `pnpm arch:check`, `pnpm validate:structure`, `pnpm validate:feature-size`, `pnpm validate:feature-docs`, `pnpm build`.
