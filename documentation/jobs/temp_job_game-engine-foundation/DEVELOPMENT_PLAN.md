# Development plan — Game engine foundation

Brief: `BRIEF.md` · Decisions: `DECISIONS.md` · Size M

## Conflict & compliance
- Placement: engine files flat in `src/shared/{services,utils,types,hooks,config}` (only flat files are whitelisted there); features `arena`, `player`, `camera`, `match` use `api/`, `services/`, `types/`, `hooks/`, `components/` (all whitelisted). Page `src/pages/GamePage.tsx`.
- Layers: components → hooks → services → types. Pixi objects are created in services (`*Renderer.ts`), mounted by `usePixiApp` (shared hook), wired by `useGameSession` (match hook). Feature components never import services.
- Cross-feature: only through `features/<x>/api/<x>Api.ts` (dependency-cruiser `no-cross-feature-internals`). Direction: match → player/camera/arena; player → arena; camera → none.
- Complexity: options objects for > 3 params (eslint `max-params`).
- Colors: numeric placeholder palette in `src/shared/config/gamePalette.ts`; theme tokens untouched.
- Testing: TDD for pure sim pieces (loop accumulator, input mapping, terrain grid, player controller, stepGame). Pixi/render is manual (browser check).
- Docs: `ARCHITECTURE.md` § Game module map; README per new feature; harness-overview README line (card no longer on `/`).
- Precedent: fixed timestep + accumulator ("Fix your timestep"), grid terrain with dirty chunks (Worms-like), renderer-only Pixi — standard. Reuse: pixi.js only (orchestrator-approved); no input/loop packages needed (each < 100 lines).

## Acceptance test
`src/features/match/services/gameSim.test.ts` › "should move the keyboard-1 player right and land it on solid cells when right is held".

## Phases
1. **Shared engine** — tunables, palette, input types + mapping, loop accumulator, input service, `usePixiApp`. Gate: unit tests + type-check.
2. **Arena** — level types, placeholder level, terrain grid (+ tests), terrain renderer, api. Gate: tests.
3. **Player + camera** — player types/controller (+ tests)/renderer, camera view (+ test), apis. Gate: tests.
4. **Match + page** — GameState, `stepGame` (acceptance test green), game renderer, `useGameSession`, `GameView`, `GamePage` at `/`, remove HomePage. Gate: full gate list + browser check.
5. **Docs** — module map in ARCHITECTURE.md, feature READMEs, fold decisions. Gate: validate:feature-docs, validate:structure.

## Progress
| Phase | Status |
|---|---|
| 1 | Done |
| 2 | Done |
| 3 | Done |
| 4 | Done |
| 5 | Done |
