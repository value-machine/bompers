# Development plan — material-system

Brief: `BRIEF.md` · Decisions: `DECISIONS.md` (D1 owner: decouple) · Size M

## Format v2 (what an agent writes)

```html
<rect data-role="terrain" data-material="ice" data-color="rose" x=".." y=".." width=".." height=".." />
```
- `data-role="terrain"` (rect / polygon / circle) — the only terrain role.
- `data-material`: `stone` (solid, default) · `earth` (breakable) · `cardboard` (breakable) · `ice` (solid, slippery).
- `data-color` (optional): `plum`, `slate`, `cardboard`, `clay`, `moss`, `mint`, `frost`, `rose`. Default per material: stone→plum, earth→clay, cardboard→cardboard, ice→frost.
- Overlap: unbreakable beats breakable; equals → later wins (D9). `data-level-format="2"`; v1 is rejected by E2 wording "old format".

## Conflict & compliance
- Rules: architecture (layers via `api/` seams), code-style naming (`terrainSwatches`, `surface` role names), testing (colocated, `should … when …`), file-placement (kit `public/level-kit/v2/` — check `pnpm validate:structure`).
- Recorded decisions replaced: DESIGN_LANGUAGE § 2 hue rule + § 1 terrain rows (D1, owner); arena README "honey tiles" (D3/D8); content-catalog "solid vs destructible from role + material" (D5).
- No new dependency, no data/irreversible change. Protected files: none expected (structure whitelist may need `v2` — ask if so).

## Phases

1. **Catalog + palette.** `MaterialEntry`: drop `lookToken`, add `defaultColor`, `surface: "plain" | "breakable" | "ice"`; ContentKind `color`; materials stone/earth/cardboard/ice; `CATALOG_DEFAULTS.material` → single `"stone"`; `LEVEL_FORMAT_VERSION = 2`; `gamePalette.terrainSwatches[id] = { fill, lip, seam }`, drop `materialLooks`/`cellLine` use. Gate: type-check of catalog tests.
2. **Level model + importer.** `TerrainPiece { shape, materialId, colorId, effectId?, soundId?, behaviorId? }` (no role); normaliser resolves unknown colour → material default (W4); importer role `terrain` with `data-material`, `data-color`, `data-effect`, `data-sound`, `data-behavior`; drop old roles (W1 for `platform`/`destructible` would be confusing → W1 message names `terrain`). Gate: level + level-file tests.
3. **Arena runtime.** Slot = `{ materialId, colorId, destructible, friction, surface }`; raster overlap per D9; `clearCircle` returns `byLook: {materialId,colorId,cells}[]`; `groundFrictionBelow(grid, span)`. Combat `terrainDestroyed` gets `colorId`; effects debris uses the swatch. Gate: arena/combat/effects tests.
4. **Renderer (D8).** `terrainRenderer`: solid group (ink, fill, lip, ice gloss/rim) unmasked; breakable group (ink masked by grown cell mask; fill+lip+seams masked by exact cell mask), masks rebuilt on dirty chunks (row runs); cracks per chunk as today. Gate: type-check + one headless smoke (console clean).
5. **Player friction (D4).** `player.groundFriction` from `groundFrictionBelow` in `updateContacts`; grounded accel/decel/turn × friction. Gate: playerController test "should keep sliding when on ice".
6. **Content + docs.** Rewrite `public/levels/*.html` (v2, mix of materials/colours; floating-garden gets ice), `git mv` kit to v2 and update `preview.js/css`, `AUTHORING.md`, `example-level.html`, `sync-level-kit.mjs`, `LEVEL_FORMAT.md`, `DESIGN_LANGUAGE.md` § 1–2, READMEs (catalog, level, level-file, arena, player, combat/effects). Keep open-map-edges bounds meaning. Gate: `pnpm level-kit:check`, `validate:structure`, docs validators.

## Acceptance test
`src/features/level-file/services/levelFileParser.test.ts` (describe "material system (acceptance)"): a v2 level with all four materials × two colours parses with no warnings; built terrain: a blast clears earth/cardboard cells of any colour and no stone/ice cells; `groundFrictionBelow` on ice < on stone. Player slide: `playerController.test.ts` case.

## Review contract
Rules pinned at `git log -1 --format=%h -- .claude/rules`; review lens: one plan-review subagent (weekday budget).
