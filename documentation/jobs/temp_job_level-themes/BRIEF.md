# Level themes — brief (size S/M, one lap)

**Problem:** every level has the same sunny meadow backdrop. The owner wants a level file to pick its background with one setting, and room for lighting later.

**Success check:** a level with any of the five new `data-theme` IDs shows that backdrop in play and in its picker thumbnail; a level without it looks exactly as before; an unknown ID loads with W24 and the meadow. The kit catalog, authoring table and LEVEL_PROMPT list the themes from the registry.

**Scope:** theme registry in `backdrop-themes` (split from `backdrop` to stay inside the feature file budget and keep readers free of Pixi) (one recipe per theme), renderer driven by a theme, `settings.themeId` through importer and normaliser, thumbnail, kit catalog / prompt / preview sky, theme assignment on six existing levels, docs (LEVEL_FORMAT § 3 and § 7, DESIGN_LANGUAGE § 1 World, feature READMEs).

**Edges:** no lighting (only a reserved `light` value), no format bump, no particles over the world, no level uses underwater yet.

## Decisions (owner, Stop 1, 2026-11-20)

- D1 one root attribute `data-theme`, one recipe file per theme plus a registry; default `meadow`; unknown → meadow + W24.
- Themes (owner Q1 B, relayed by the orchestrator after a first build with three): night sky, snowy peaks, lava cave, underwater, city rooftops.
- Existing levels get themes in this lap: `slush-bowl`, `bobsled-run`, `crystal-gap` → snowy-peaks; `bonfire-bridge` → lava-cave; `piston-works` → city-rooftops; kit sample `orbit-test-level.html` → night-sky.
- D4 keep the ink outline as is on dark themes; judge in play.
- Agent decisions: D2 colours in `GAME_PALETTE.backdropThemes` + DESIGN_LANGUAGE; particles behind the world (layer order); D3 `light` reserved, strength 0.

## Verification

Done: type-check, lint (no new warnings), targeted Vitest (backdrop, level, level-file, level-kit, match, lobby: 294 pass), `level-kit:check`, `validate:structure`, `validate:feature-size`, `arch:check`, `pnpm build`.

Not done: no browser run of the game (thread limited to pnpm commands); the look is judged on the PR preview.
