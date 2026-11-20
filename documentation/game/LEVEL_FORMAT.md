# Bompers level file format — v2

Status: spec for format version **2** (v1 retired without migration: material-system D2). Product decision: [`DOC_APP_VISION.md` § Levels](../DOC_APP_VISION.md). Gameplay SSOT: [`GAME_DESIGN_DOCUMENT.md`](GAME_DESIGN_DOCUMENT.md).
Agent-facing one-pager (write a level in one shot): [`public/level-kit/v2/AUTHORING.md`](../../public/level-kit/v2/AUTHORING.md), hosted at `/level-kit/v2/AUTHORING.md`.

A level is **one self-contained HTML file with one inline `<svg>`**. Any AI agent can write it, any browser shows it as a picture, and the game's importer turns it into its internal typed `LevelDefinition`. The engine never reads the file format directly.

## 1. Principles

1. **Geometry, roles and IDs only.** The file says *where* things are and *what role* they play. Materials, colours, effects, sounds, behaviours and items are referenced by stable string ID; their content lives in the game's content catalog in code.
2. **Material = behaviour, colour = looks.** A terrain shape's `data-material` sets what it does (breakable, slippery, sound, effect); its optional `data-color` only paints it. Any colour goes on any material. The game shows behaviour through a surface pattern that never depends on colour (DESIGN_LANGUAGE § 2).
3. **Presentation is not data.** `fill`, `stroke`, `style`, `<title>`, comments and any element without `data-role` are for humans. The game ignores them.
4. **Forgiving: reject only what the game cannot run.** An unknown ID, a missing bounds or drop point, a bad viewBox with another size to go on, or a broken shape warns and falls back (§ 7); only a file with no root, a newer format, no size, no terrain or no place to spawn is an import error with a readable message (level-direction D3). Nothing crashes the game.
5. **Viewable anywhere.** The file renders as a plain picture with no network. Linking the hosted kit (§ 9) adds a legend, labels and a grid.

## 2. File skeleton

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>My Level — Bompers level</title>
    <link rel="stylesheet" href="https://bompers.tom-fab.workers.dev/level-kit/v2/preview.css" />
    <script src="https://bompers.tom-fab.workers.dev/level-kit/v2/preview.js" defer></script>
  </head>
  <body>
    <svg id="level" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000"
         data-level-format="2" data-title="My Level">
      <!-- shapes with data-role -->
    </svg>
  </body>
</html>
```

The kit origin is the game's production site, `https://bompers.tom-fab.workers.dev` (§ 9). The importer reads only the root `<svg>`; everything else in the HTML is ignored, so a bare `.svg` with the same root is accepted too.

## 3. Root element

The level root is the **first `<svg>` element with a `data-level-format` attribute**. Exactly one per file.

| Attribute | Required | Type | Meaning |
|---|---|---|---|
| `data-level-format` | yes | integer | Format version. This spec is `2`. |
| `viewBox` | yes | `0 0 W H` | World size in world units. Must start at `0 0`; `W`, `H` > 0. |
| `data-title` | yes | text | Display name. |
| `data-level-id` | no | ID (§ 6) | Stable slug, e.g. `floating-garden`. Default: slug of the title. |
| `data-author` | no | text | Person or team. |
| `data-agent` | no | text | The AI agent that wrote it (`claude`, `gemini`, `chatgpt`, …). |
| `data-description` | no | text | One or two sentences. |
| `data-cell-size` | no | integer ≥ 1 | World units between terrain samples (each sample stores its material and its distance to the nearest terrain edge, so craters and slopes stay curved between samples). Default: catalog `defaults.cellSize` (4). |
| `data-gravity` | no | number > 0 | Multiplier of the engine's default gravity. Default `1`. |
| `data-match-duration` | no | integer seconds > 0 | Overrides the match length for this level. Default: the match setting. |
| `data-weapons` | no | space-separated weapon item IDs, or `none` | Limits the weapons the sky crates hold on this level, in turn; `none` = no weapon crates. Left out (or `auto`): the match setting, which defaults to every weapon the game has (level-direction D6). Non-weapon IDs are left out (W4). |

Per-level settings are the GDD's "per map" settings (§ 7 of the GDD: match duration, gravity, weapons). They are optional defaults in the family of the match settings (level-direction D7); the precedence against the lobby's choice belongs to the settings module, not the file.

## 4. Geometry and the terrain grid

- **Units:** 1 SVG user unit = 1 world unit. No other unit (`px`, `%`, `em`) is allowed on geometry attributes.
- **Origin and axes:** origin top-left, x to the right, **y down** (SVG and PixiJS native; no flip).
- **World:** the `viewBox` rectangle. The terrain grid covers it with `ceil(W / cell)` × `ceil(H / cell)` cells; cell `(i, j)` spans `[i·cell, (i+1)·cell) × [j·cell, (j+1)·cell)`.
- **Rasterising terrain:** a cell is solid when its **centre** `((i+0.5)·cell, (j+0.5)·cell)` lies inside a `terrain` shape (rect corners rounded by the slab radius ≈ 6.2 units, as drawn). Polygons use the **non-zero** fill rule. Where shapes overlap, an unbreakable material wins over a breakable one (unbreakable stays unbreakable); otherwise the later shape in document order sets material and colour.
- **Points:** spawn, drop and collectible are circles; the **centre** is the point, `r` is visual only.
- Coordinates may be fractional; the importer rounds nothing except through centre sampling.

Recommended: make terrain edges multiples of the cell size, so the picture and the game agree exactly.

## 5. Allowed SVG subset

| Element | Allowed for | Notes |
|---|---|---|
| `<rect>` | terrain, `bounds` | `x`, `y`, `width`, `height`. `rx`/`ry` are visual only (ignored). |
| `<polygon>` | terrain | `points="x,y x,y …"`, ≥ 3 points; implicitly closed. |
| `<circle>` | terrain, points | `cx`, `cy`, `r`. |
| `<g>` | grouping; with `data-motion`, a moving part (§ 11) | No `transform`, no `data-role`. Role attributes are never inherited from a group. |
| `<title>`, `<desc>`, `<text>`, comments, `<defs>`, `<style>` | presentation | Ignored by the game. |

**Not allowed on role elements, and why:**

- `<path>`: needs a full `d` parser with arcs and curve flattening, and agents produce inconsistent paths. Polygons express every terrain shape the game rasterises into cells anyway.
- `<ellipse>`, `<line>`, `<polyline>`, `<use>`, `<image>`, nested `<svg>`: no role in the format; `use` and nested viewports change coordinates.
- `transform` anywhere on a role element **or its ancestors** (up to the root): keeps geometry literal, so a reader needs no matrix maths. **One exception (level-orbit D1):** an `object` rect may carry its own `transform="rotate(a)"` or `rotate(a cx cy)` (SVG semantics: degrees clockwise about `(cx, cy)`, default the origin). The object is built upright in the rect and turned as a whole, so its top points where the rect's top points; the preview draws the same turn. Any other transform on an object, or a transform on its ancestors, is still W3.

A role on a disallowed element is an import **warning** and the element is skipped (it still shows in the picture).

## 6. Roles and references

Every game-relevant shape carries `data-role`. Elements without it are decoration.

| `data-role` | Shape | Count | Meaning | Reference attributes |
|---|---|---|---|---|
| `terrain` | rect, polygon, circle | ≥ 1 | Solid ground. Its material decides whether explosions clear its cells and how it plays (e.g. ice is slippery). | `data-material` (default `defaults.material`), `data-color` (default: the material's `defaultColor`), `data-effect`, `data-sound`, `data-behavior` |
| `object` | rect | ≥ 0 | A ready-made object (a tree, …) the game builds inside the rect from catalog materials (level-objects lap 1): it stands on the rect's bottom centre and fills its height; the width is its spread, clamped to the variant's width range (width ÷ height), the height to the kind's range. Its parts are ordinary terrain pieces at the element's place in document order (later shapes paint over earlier ones), so they collide, crater, burn and freeze like terrain; inside a `<g data-motion>` they move with the part. Kinds, variants and ranges come from the object registry in the game code (`src/features/level-objects`), listed in the table below and in `catalog.json` `object`. Thin parts are at least 8 units (two samples at the default `data-cell-size` 4); a coarser cell size can lose twigs. | `data-kind` (required), `data-variant` (optional; `transform="rotate(a cx cy)"` optional, § 5; omitted = a seeded pick, unknown = the kind's default), `data-seed` (optional whole number; default: hash of the level id and the element's `id`, else its object ordinal (separate namespaces)) |
| `spawn` | circle | ≥ 2 (≥ 4 recommended) | Player spawn point. The game picks the one farthest from active opponents (GDD § 6). | `data-behavior` |
| `drop` | circle | ≥ 1 | Where weapon crates fall from (GDD § 3–4). A spawn point only: which weapon falls is the match's weapons setting (root `data-weapons`, § 3). | `data-behavior` |
| `collectible` | circle | ≥ 0 | A pickup point. `point-orb` (default): point orbs fall from the sky onto it (GDD § 5). `dive-reset`: a headbutt reset floats there from the start; a player whose dive is spent in the air takes it and gets the dive back, then it is gone 2.5 s (FEEDBACK_ROUND_2 § 2.3). Only items with `use: collectible`. | `data-item` (one item ID; default `defaults.items.collectible`), `data-behavior` |
| `bounds` | rect | exactly 1 | The in-bounds area. A player whose centre falls below its bottom edge is out of bounds (eliminated; vision § How the GDD is read); the engine sets the side and top kill lines far beyond it. Must lie within the viewBox. | — |

At least one `terrain` shape is required.

**Common optional attributes** on any role element: `id` (unique in the file; lets later formats and tools refer to it), `data-label` (human label shown by the preview kit).

**Reference attributes** and their catalog kind:

| Attribute | Catalog kind | Purpose |
|---|---|---|
| `data-material` | `material` | Behaviour: breakable or not, friction (ice), surface pattern; supplies the default colour, effect and sound. |
| `data-color` | `color` | Looks only: the terrain colour swatch (RGB in the game palette and in `catalog.json`). Named colours only, no hex. |
| `data-effect` | `effect` | Visual effect when cells of this shape are destroyed (overrides the material's). |
| `data-sound` | `sound` | Sound when cells of this shape are hit or destroyed (overrides the material's). |
| `data-behavior` | `behavior` | Extra behaviour (moving, bouncy, …). None exist in the catalog yet; reserved so files need no format change when they arrive. |
| `data-item` | `item` | What a collectible spawn produces. |

**Materials and colours in short:** `stone` (solid, default), `earth` and `cardboard` (breakable), `ice` (solid, slippery); colours `plum`, `slate`, `cardboard`, `clay`, `moss`, `mint`, `frost`, `rose` on any of them. The generated table below is the authority.

**ID syntax:** lowercase kebab-case, `^[a-z][a-z0-9-]*$`, at most 64 characters. IDs are stable: once shipped, a catalog ID is never renamed or reused; retired IDs keep an alias entry in the catalog that maps to their replacement.

**The catalog** in the game code is the single source of IDs. The kit's [`catalog.json`](../../public/level-kit/v2/catalog.json) and the table below are generated from it (`pnpm level-kit:sync`); the CI step `pnpm level-kit:check` fails when they lag behind the code.

<!-- level-kit:catalog-ids:start (generated by pnpm level-kit:sync; do not edit) -->
| Kind | ID | Label | Notes |
|---|---|---|---|
| material | `stone` | Stone | unbreakable, looks: smooth slab, effect `none`, sound `thud`, default for terrain |
| material | `earth` | Earth | toughness 1, looks: smooth slab, effect `dust-burst`, sound `crumble` |
| material | `cardboard` | Cardboard | toughness 0.7, looks: smooth slab, effect `dust-burst`, sound `thwap` |
| material | `ice` | Ice | unbreakable, slippery, looks: gloss streaks + white rim, effect `none`, sound `clink` |
| color | `plum` | Plum | default for stone |
| color | `slate` | Slate |  |
| color | `cardboard` | Cardboard | default for cardboard |
| color | `clay` | Clay | default for earth |
| color | `moss` | Moss |  |
| color | `mint` | Mint |  |
| color | `frost` | Frost | default for ice |
| color | `rose` | Rose |  |
| color | `bark` | Bark |  |
| effect | `none` | No effect |  |
| effect | `dust-burst` | Dust burst |  |
| sound | `none` | Silent |  |
| sound | `thud` | Thud |  |
| sound | `crumble` | Crumble |  |
| sound | `thwap` | Thwap |  |
| sound | `clink` | Clink |  |
| sound | `jump` | Jump |  |
| sound | `land` | Land |  |
| sound | `tumble-bounce` | Roll bounce |  |
| sound | `dive-launch` | Dive launch |  |
| sound | `dive-impact` | Dive impact |  |
| sound | `hit` | Hit |  |
| sound | `elimination` | Elimination |  |
| sound | `rocket-fire` | Rocket fire |  |
| sound | `explosion` | Explosion |  |
| sound | `pickup` | Pickup |  |
| sound | `respawn` | Respawn |  |
| sound | `round-start` | Round start |  |
| sound | `round-end` | Round end |  |
| sound | `torch-start` | Torch start |  |
| sound | `torch-loop` | Torch spraying (loop) |  |
| sound | `fire-crackle` | Fire crackle (loop) |  |
| sound | `burn-out` | Burn-out |  |
| sound | `catch-fire` | Catch fire |  |
| sound | `steam-hiss` | Steam hiss |  |
| sound | `freeze-start` | Freeze start |  |
| sound | `freeze-loop` | Freeze ray (loop) |  |
| sound | `thaw` | Thaw |  |
| sound | `freeze-solid` | Freeze solid |  |
| sound | `ice-crack` | Ice crack |  |
| sound | `ice-shatter` | Ice shatter |  |
| sound | `orb-collect` | Orb collect |  |
| behavior | — | none yet; leave it out | |
| item | `rocket-launcher` | Rocket launcher | use: drop |
| item | `homing-launcher` | Homing launcher | use: drop |
| item | `torch` | Torch | use: drop |
| item | `freeze-ray` | Freeze ray | use: drop |
| item | `point-orb` | Point orb | use: collectible, default for collectible |
| item | `dive-reset` | Headbutt reset | use: collectible |
| object | `tree` / `oak` | Round oak | height 96–480, width 0.6–1.2 × height, default variant |
| object | `tree` / `pine` | Pine | height 96–480, width 0.35–0.75 × height |
| object | `tree` / `snowy-pine` | Snowy pine | height 96–480, width 0.35–0.75 × height |
| object | `tree` / `palm` | Palm | height 96–480, width 0.5–1.1 × height |
| object | `tree` / `dead` | Dead tree | height 96–480, width 0.5–1.1 × height |
<!-- level-kit:catalog-ids:end -->

## 7. Validation

The importer produces **errors** (level rejected, readable message naming the element) and **warnings** (level loads, message shown). It is forgiving (level-direction D3): an odd but playable file loads as written with warnings; only a file the game cannot run is rejected. The lobby's import report has a **Copy report** button that copies every remaining error and warning as plain text for the author's AI.

**Errors** (E4, E7 and E8 are retired: now W18, W20 and W21; their numbers are not reused)

| # | Rule |
|---|---|
| E1 | No root `<svg data-level-format>` found (more than one: W15). |
| E2 | `data-level-format` is newer than the game supports ("made for a newer version of the game"), or older with no migration (§ 8). Not a number at all: W16. |
| E3 | No world size: the `viewBox` is unusable (W17) and neither the root's `width`/`height` nor the `bounds` rect gives one. |
| E5 | No valid `spawn` point and no room to place one above the terrain (W19). |
| E6 | No valid terrain shape. |

**Warnings** (the element is skipped or the default used)

| # | Rule | Fallback |
|---|---|---|
| W1 | Unknown `data-role` value. | Element ignored. |
| W2 | Role on a disallowed element, or a point role on a non-circle. | Element ignored. |
| W3 | `transform` on a role element or its ancestors. | Element ignored. |
| W4 | Unknown or malformed reference ID (material, color, effect, sound, behavior, item), or a non-weapon ID in `data-weapons`. | Catalog default (colour: the material's); `data-weapons` leaves the ID out, and with none left uses the match setting. |
| W5 | Point (spawn/drop/collectible) outside `bounds`, or a spawn inside solid terrain. | Point ignored. |
| W6 | Fewer than 4 spawn points (even one). | Spawns are shared. |
| W7 | Duplicate `id`. | Later duplicates lose their id. |
| W8 | Setting out of range (`data-cell-size` < 1, `data-gravity` ≤ 0, `data-match-duration` ≤ 0, non-numeric). | Default. |
| W9 | Missing `data-title`. | "Untitled level". |
| W10 | Unknown `data-*` attribute on a role element. | Ignored (forward compatibility). |
| W11 | A `drop` item (a weapon) in a collectible's `data-item` (the item's `use` in the catalog). | Default collectible. |
| W12 | A `data-motion` that does not parse, a group without terrain, or more than 16 moving parts; also notes a clamped period or an offset off the cell grid (§ 11). | The group stays still (its shapes stay static terrain); clamped / off-grid values are used as noted. |
| W13 | Inside a moving group: a non-terrain role or a nested `data-motion`. | The point stays still; the inner motion is ignored. (A part may be any material; the old warning for breakable materials is gone.) |
| W14 | Over one cycle the part leaves `bounds`, runs into static terrain, comes within half a player of a spawn point (one warning per spawn, naming it; for `spin` / `swing` it names the distance from the pivot that clears everything the part carries — the game skips a covered spawn when it places a player), or moves faster than a player runs (sampled 48 times per cycle; the first time is named). | Level loads as written. |
| W15 | More than one root `<svg data-level-format>` (was E1). | The first is the level; the others are ignored. |
| W16 | `data-level-format` is not a whole number ≥ 1 (and not a number above the game's version). | Read as the game's version. |
| W17 | `viewBox` missing or not `0 0 W H` with `W`, `H` > 0 (was E3). | An offset `x y W H` → world `0 0 x+W y+H`; else the root's `width`/`height`; else the `bounds` rect's far corner. |
| W18 | Not exactly one valid `bounds` rect, or it lies outside the viewBox (was E4). | None: the whole world; several: the first; sticking out: clipped to the world. |
| W19 | No valid `spawn` point (was E5; one spawn is W6). | Up to 4 spawns, a spawn-lift above the top centre of the widest terrain shapes, inside bounds and out of terrain. |
| W20 | No valid `drop` point (was E7). | No weapon crates fall on this level. |
| W21 | A geometry attribute required by its shape is missing, non-numeric, non-positive or uses a unit (was E8; the element is named). | Element ignored (it can still leave too little for E5 / E6). |
| W22 | An `object` with no `data-kind`, or a kind the game doesn't know. | Element ignored (a misspelled kind never turns into another object). |
| W23 | An `object` corrected: unknown `data-variant`, height outside the kind's range or width outside the variant's range, `data-seed` not a whole number. | The kind's default variant; the size clamped on the same bottom centre; the default seed. |
| W24 | An `object`'s base (the rect's bottom centre, turned with it) is more than 12 units off or inside the terrain shapes, or its up direction leans more than 30° from the surface's outward direction there (level-orbit D3). The message names the `rotate(a x y)` that fits. | Object built as written. |

The preview kit runs a subset of these checks in the browser and lists them under the legend.

## 8. Versioning and migration

- `data-level-format` is a single integer, bumped only for a **breaking** change (a role, attribute or rule whose meaning changes or disappears).
- **Additive** changes do **not** bump the version: new catalog IDs, new optional attributes, new roles. Older games warn on what they don't know (W1, W10) and keep working.
- The importer keeps one migration per step, `migrate_N_to_N+1(dom)`, operating on the parsed SVG before validation. Importing a file with version `N` runs every step up to the current version. Migrations are pure, tested with a fixture file per old version, and never removed.
- A file newer than the game is rejected with E2 (never guessed at).
- ID renames are not migrations: the catalog's alias entries handle them (§ 6).
- The kit is versioned with the format: format N is served under `/level-kit/vN/`. Normally the old folder stays beside the new one; v1 was removed with format 2 because the owner waived compatibility (material-system D10).
- Format 2 (one `terrain` role with material + colour) shipped without a v1 → v2 migration: v1 files are rejected with E2 and must be rewritten.

## 9. Hosted kit

Served from the game's own site under `/level-kit/v2/`:

| File | Purpose |
|---|---|
| `preview.css` | Role colours (overrides the file's own fills for a consistent look; terrain stroke dashed = breakable, white = ice), panel layout. |
| `preview.js` | Legend with counts, metadata, point labels, terrain-grid overlay (toggle), soft validation; reads `catalog.json` next to itself to flag unknown IDs and paint terrain in its `data-color`. No dependencies. |
| `catalog.json` | Current catalog IDs per kind (colours with their `fill` / `lip` hex) and the defaults. |
| `AUTHORING.md` | The agent one-pager. |
| `LEVEL_PROMPT.md` | The copyable AI prompt (the lobby's "Copy AI prompt" copies the same text), generated whole from the format, catalog and game tunables by `pnpm level-kit:sync`. |
| `example-level.html` | A complete level using relative kit links (works served or opened from the repo). |
| `fire-test-level.html` | A level for testing fire: two big cardboard slabs, thin cardboard platforms and small blocks on a stone floor, with a torch in every drop (owner, fire-clusters, 2026-11-17). Import it in the lobby. |
| `orbit-test-level.html` | A spinning planet with five trees turned to face outward (`rotate(a 900 680)` about the planet centre) and spawns above the trees' reach (level-orbit lap). Import it in the lobby; it loads with no warnings. |
| `crusher-test-level.html` | A level for testing moving parts: a block that slides into a wall and thuds at each end (stand in the gap to be crushed), a block that stops 20 short of a post (stand in the gap to be squeezed and survive), a spinning bar to ride, and a fast lift to jump off, each a short walk from a spawn (orchestrator, moving-parts lap B-2). Import it in the lobby. |
| `forgiving-test-level.html` | A deliberately odd but playable level (forgiving-import): version `2.0`, no viewBox, no bounds, one spawn, no drops, a block in `px` and a two-point polygon. It loads with W16, W17, W21 ×2, W18, W6 and W20; the lobby's **Copy report** copies them. |

Agent-written levels link the kit with absolute URLs on `https://bompers.tom-fab.workers.dev`, the game's production origin. Without network access the links fail silently and the file is still a correct picture.

## 10. Mapping to the game

The importer (`src/features/level-file/`, `parseLevelFile`) produces `LevelDefinition`, owned by the engine. Expected mapping: root settings → level settings; viewBox + cell size → terrain grid dimensions; terrain shapes → per-cell material ID, colour ID, breakable flag, friction and surface pattern; points → typed point lists; bounds → a world rectangle; every reference → a resolved catalog ID plus collected warnings.

## 11. Moving parts

A `<g data-motion="…">` turns the `terrain` shapes inside it into **one moving part** (additive, no version bump, § 8; an older game keeps them still). Decisions: moving-parts D1–D16 (lap ledger, folded into the `level` and `level-file` READMEs).

- **Rest pose:** draw the shapes where the part rests, in ordinary absolute coordinates. The motion is relative to that place, so the part lines up with the rest of the level the way static terrain does. Never use `transform`; W3 still applies.
- **Grammar:** `<kind> <args> [Ns] [@phase] [pivot] [ccw]`. The kind comes first; the optional tokens follow in any order.

| Kind | Args | Moves |
|---|---|---|
| `slide` | one `dx,dy` | Back and forth between rest and rest + `dx,dy`, easing at both ends (`(1 − cos 2πu) / 2`). |
| `path` | one or more `dx,dy` | Closed loop rest → each offset → rest at constant speed. |
| `spin` | — | One full turn per period about the pivot; clockwise on screen, `ccw` reverses. |
| `swing` | one angle in degrees, 0 < a ≤ 180 | Pendulum `a · sin 2πu` about the pivot, starting at rest; `ccw` starts the other way. |

- **Timing:** `Ns` = seconds per cycle (default `4s`, clamped to 1–30). `@f` starts `f` of a cycle ahead. Parts with the same period and phase move in lockstep; `@0.5` moves opposite. The pose is a pure function of round time (`motionPose` in `src/shared/utils/levelMotion.ts`), so a restart replays it exactly.
- **Pivot:** a named point of the bounding box of the part's terrain shapes (objects riding the part don't count, so a planet ringed with trees spins about the planet; a part made only of objects uses theirs, level-orbit D2): `center` (default for `spin`), `top` (default for `swing`), `bottom`, `left`, `right`, `top-left`, `top-right`, `bottom-left`, `bottom-right`. Shapes on the grid give pivots on the grid, so no arithmetic is needed.
- **What moves:** terrain only. A spawn, drop or collectible inside the group stays still (W13). A nested `data-motion` is ignored (W13). A moving part is made of its material like any terrain (owner, mover-materials D1, D2; lap 4): blasts crater a part by its material's toughness, where the part is at that moment, so earth and cardboard parts break and stone and ice parts stay whole; a frozen part is as hard as ice while frozen. A part cut in two keeps moving as two pieces. A part takes its material's fire (owner, mover-materials D2): a part of a material that burns (cardboard) is lit by the torch, the fire spreads through that part only, sets blobs that touch it alight and burns the part away piece by piece; riders fall when their footing is gone. A stone, earth or ice part never lights. The freeze ray freezes a part of any material except ice where the beam touches it (mover-materials lap 2b): the frozen patch rides with the part, is slippery, keeps fire out, and thaws by itself or under the torch.
- **Limits:** at most 16 parts. Offsets go on the cell grid. Over a whole cycle the part stays inside `bounds`, never overlaps static terrain, keeps half a player (14) from spawn centres, and its fastest point stays at or below a player's run speed (W14). The importer checks 48 poses per cycle, with edge points 8 units apart, and lets touching (up to 2 units deep) pass. A clean import is therefore strong evidence, not proof: leave a margin around thin posts.
- **Engine mapping:** `LevelDefinition.movers[]` = `{ motion, pivot, terrainIndices }`. The pieces stay in `terrain` at their rest pose. The arena leaves them out of the static samples.
- **Runtime:** each part is a kinematic body with its own local distance field, queried in the part's frame and never baked into the static field (`arena`). The solid queries see it, so every body collides with it. Each step the part takes its pose for the sim time. Riders (players, crates) are then carried by the motion of the point under their feet, rotation included, and a part running into a body pushes it out (`movers`, before the players move). Rockets explode on parts without making a crater. Respawns skip spawns a part covers. The look is the same slab plus a one-rule outline from the part's own field, with no motion cue (owner, lap B B1). A player squeezed between a part and static terrain or another part squashes to fit the gap and springs back when it opens; it can still move and jump out. Only a gap under `player.crushGapFraction` (20%) of the body width eliminates it, with credit to the last hitter (owner, D13; change round on #64, B5). It shows as a pancake held 0.15 s, then goo splats on both faces; the splats on the part ride with it (owner, B3). The crush sounds are `land`, then `elimination`. A body that leaves a part (jump, dive, walking off) keeps the part's velocity once, capped at the ride speed (B4).
- **Sounds:** parts are silent unless the author declares sounds on the `<g>` (owner, B2). `data-move-sound` plays as the part passes its fastest point: halfway along a slide or path leg, through the bottom of a swing, once per spin turn. `data-end-sound` plays at each turning point: both ends of a slide, each path waypoint, each swing extreme (`motionCuePoints`). Values are `data-sound` catalog IDs; an unknown one warns W4 and stays off.

```html
<g data-motion="slide 0,-160">
  <rect data-role="terrain" x="640" y="560" width="160" height="32" fill="#5a3f7a" />
</g>
<g data-motion="swing 40 3s @0.5">
  <rect data-role="terrain" x="1000" y="240" width="16" height="200" fill="#5a3f7a" />
  <rect data-role="terrain" x="960" y="440" width="96" height="24" fill="#5a3f7a" />
</g>
```
