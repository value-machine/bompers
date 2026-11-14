# Brief — Design language for the game

Task: Design language for the game · Lap: temp_job_game-design-language · Harness: v0.44.0

## Problem
The visual pass, HUD and sound threads have no shared art and audio direction, and the app chrome still wears the harness's bronze-plate theme.

## Success check
`documentation/game/DESIGN_LANGUAGE.md` gives exact hex values and rules for the picked direction (A · Gumdrop Pop + C's contact shadow), and the theme tokens produce menus/HUD chrome in that palette with every text/background pair at WCAG AA (≥ 4.5:1), verified by `pnpm tokens:build` + the token contract tests.

## In scope
- DESIGN_LANGUAGE.md: player colours + colour-blind check, emblems, arena (solid vs destructible), background, FX, outline in world units with zoom clamp, draw order (FX under player outlines), contact shadow, squash/motion numbers, HUD/type, audio identity + SFX list.
- Light/dark colour tokens, radius, brand elevation and fonts (Fredoka) in `src/shared/theme/tokens/`; `pnpm tokens:build`.
- Google Fonts link in `index.html` (fonts change), `documentation/DOC_THEMING.md` § Default theme.

## Out of scope
- Will NOT do: game rendering code, a palette module in src/ (engine thread owns it), sound files, image generation.
- Will NOT touch: `src/config/app-tasks.json`, token names / `THEME_TOKENS` contract, kit component structure.

## Edges
| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| shared/theme tokens | DTCG JSON → `pnpm tokens:build` → `tokens.generated.css` → `@theme inline` utilities | token values only | ride — values change, names stay |
| index.html fonts | Google Fonts `<link>` for Cinzel + Inter | swap the family list | ride |
| documentation/game | GDD only | new DESIGN_LANGUAGE.md beside it | new — SSOT the orchestrator asked for |

## Size
S — doc + token values, no logic.
Cut into laps: none.

## Decisions
- Direction A · Gumdrop Pop with C's flat contact shadow (orchestrator pick, 2026-11-14).
- Fonts load from Google Fonts like the existing setup; self-hosting via a package would be a new dependency.
