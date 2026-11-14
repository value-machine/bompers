# Bompers level file format — v1

Status: spec for format version **1**. Product decision: [`DOC_APP_VISION.md` § Levels](../DOC_APP_VISION.md). Gameplay SSOT: [`GAME_DESIGN_DOCUMENT.md`](GAME_DESIGN_DOCUMENT.md).
Agent-facing one-pager (write a level in one shot): [`public/level-kit/v1/AUTHORING.md`](../../public/level-kit/v1/AUTHORING.md), hosted at `/level-kit/v1/AUTHORING.md`.

A level is **one self-contained HTML file with one inline `<svg>`**. Any AI agent can write it, any browser shows it as a picture, and the game's importer turns it into its internal typed `LevelDefinition`. The engine never reads the file format directly.

## 1. Principles

1. **Geometry, roles and IDs only.** The file says *where* things are and *what role* they play. Materials, effects, sounds, behaviours and items are referenced by stable string ID; their content lives in the game's content catalog in code.
2. **Presentation is not data.** `fill`, `stroke`, `style`, `<title>`, comments and any element without `data-role` are for humans. The game ignores them.
3. **Forgiving on IDs, strict on structure.** An unknown ID warns and falls back to a default; a broken structure (no root, no bounds, bad viewBox) is an import error with a readable message. Nothing crashes the game.
4. **Viewable anywhere.** The file renders as a plain picture with no network. Linking the hosted kit (§ 9) adds a legend, labels and a grid.

## 2. File skeleton

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>My Level — Bompers level</title>
    <link rel="stylesheet" href="https://bompers.tom-fab.workers.dev/level-kit/v1/preview.css" />
    <script src="https://bompers.tom-fab.workers.dev/level-kit/v1/preview.js" defer></script>
  </head>
  <body>
    <svg id="level" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000"
         data-level-format="1" data-title="My Level">
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
| `data-level-format` | yes | integer | Format version. This spec is `1`. |
| `viewBox` | yes | `0 0 W H` | World size in world units. Must start at `0 0`; `W`, `H` > 0. |
| `data-title` | yes | text | Display name. |
| `data-level-id` | no | ID (§ 6) | Stable slug, e.g. `floating-garden`. Default: slug of the title. |
| `data-author` | no | text | Person or team. |
| `data-agent` | no | text | The AI agent that wrote it (`claude`, `gemini`, `chatgpt`, …). |
| `data-description` | no | text | One or two sentences. |
| `data-cell-size` | no | integer ≥ 1 | World units per terrain cell. Default: catalog `defaults.cellSize` (8). |
| `data-gravity` | no | number > 0 | Multiplier of the engine's default gravity. Default `1`. |
| `data-match-duration` | no | integer seconds > 0 | Overrides the match length for this level. Default: the match setting. |

Per-level settings are the GDD's "per map" settings (§ 7 of the GDD: match duration and gravity). Player-chosen match settings may override them; that precedence belongs to the settings module, not the file.

## 4. Geometry and the terrain grid

- **Units:** 1 SVG user unit = 1 world unit. No other unit (`px`, `%`, `em`) is allowed on geometry attributes.
- **Origin and axes:** origin top-left, x to the right, **y down** (SVG and PixiJS native; no flip).
- **World:** the `viewBox` rectangle. The terrain grid covers it with `ceil(W / cell)` × `ceil(H / cell)` cells; cell `(i, j)` spans `[i·cell, (i+1)·cell) × [j·cell, (j+1)·cell)`.
- **Rasterising terrain:** a cell is solid when its **centre** `((i+0.5)·cell, (j+0.5)·cell)` lies inside a terrain shape (`platform` or `destructible`). Polygons use the **non-zero** fill rule. Where shapes overlap, `platform` wins over `destructible` (indestructible stays indestructible); between two shapes of the same role, the later one in document order sets the material.
- **Points:** spawn, drop and collectible are circles; the **centre** is the point, `r` is visual only.
- Coordinates may be fractional; the importer rounds nothing except through centre sampling.

Recommended: make terrain edges multiples of the cell size, so the picture and the game agree exactly.

## 5. Allowed SVG subset

| Element | Allowed for | Notes |
|---|---|---|
| `<rect>` | terrain, `bounds` | `x`, `y`, `width`, `height`. `rx`/`ry` are visual only (ignored). |
| `<polygon>` | terrain | `points="x,y x,y …"`, ≥ 3 points; implicitly closed. |
| `<circle>` | terrain, points | `cx`, `cy`, `r`. |
| `<g>` | grouping only | No `transform`, no `data-role`. Role attributes are never inherited from a group. |
| `<title>`, `<desc>`, `<text>`, comments, `<defs>`, `<style>` | presentation | Ignored by the game. |

**Not allowed on role elements, and why:**

- `<path>`: needs a full `d` parser with arcs and curve flattening, and agents produce inconsistent paths. Polygons express every terrain shape the game rasterises into cells anyway.
- `<ellipse>`, `<line>`, `<polyline>`, `<use>`, `<image>`, nested `<svg>`: no role in the format; `use` and nested viewports change coordinates.
- `transform` anywhere on a role element **or its ancestors** (up to the root): keeps geometry literal, so a reader needs no matrix maths.

A role on a disallowed element is an import **warning** and the element is skipped (it still shows in the picture).

## 6. Roles and references

Every game-relevant shape carries `data-role`. Elements without it are decoration.

| `data-role` | Shape | Count | Meaning | Reference attributes |
|---|---|---|---|---|
| `platform` | rect, polygon, circle | ≥ 0 | Solid, indestructible terrain. | `data-material` (default `defaults.material.platform`), `data-behavior` |
| `destructible` | rect, polygon, circle | ≥ 0 | Solid terrain whose cells explosions clear. | `data-material` (default `defaults.material.destructible`), `data-effect`, `data-sound`, `data-behavior` |
| `spawn` | circle | ≥ 2 (≥ 4 recommended) | Player spawn point. The game picks the one farthest from active opponents (GDD § 6). | `data-behavior` |
| `drop` | circle | ≥ 1 | Where weapons and power-ups fall from (GDD § 3–4). | `data-items` (space-separated item IDs; default `defaults.items.drop`), `data-behavior` |
| `collectible` | circle | ≥ 0 | Where collectibles (points) appear (GDD § 5). | `data-item` (one item ID; default `defaults.items.collectible`), `data-behavior` |
| `bounds` | rect | exactly 1 | The in-bounds area. A player whose centre leaves it is out of bounds (eliminated; vision § How the GDD is read). Must lie within the viewBox. | — |

At least one `platform` or `destructible` shape is required.

**Common optional attributes** on any role element: `id` (unique in the file; lets later formats and tools refer to it), `data-label` (human label shown by the preview kit).

**Reference attributes** and their catalog kind:

| Attribute | Catalog kind | Purpose |
|---|---|---|
| `data-material` | `material` | Look, destructibility feel; the material supplies default effect and sound. |
| `data-effect` | `effect` | Visual effect when cells of this shape are destroyed (overrides the material's). |
| `data-sound` | `sound` | Sound when cells of this shape are hit or destroyed (overrides the material's). |
| `data-behavior` | `behavior` | Extra behaviour (moving, bouncy, …). None exist in v1's catalog; reserved so files need no format change when they arrive. |
| `data-items` / `data-item` | `item` | What a drop point or collectible spawn produces. |

**ID syntax:** lowercase kebab-case, `^[a-z][a-z0-9-]*$`, at most 64 characters. IDs are stable: once shipped, a catalog ID is never renamed or reused; retired IDs keep an alias entry in the catalog that maps to their replacement.

**The catalog** in the game code is the single source of IDs. The kit's [`catalog.json`](../../public/level-kit/v1/catalog.json) is a generated copy for agents and the preview (placeholder until the importer lap generates it from code; a CI drift check then keeps it current).

## 7. Validation

The importer produces **errors** (level rejected, readable message naming the element) and **warnings** (level loads, message shown).

**Errors**

| # | Rule |
|---|---|
| E1 | No root `<svg data-level-format>` found, or more than one. |
| E2 | `data-level-format` is not an integer, or is newer than the game supports ("made for a newer version of the game"). |
| E3 | `viewBox` missing or not `0 0 W H` with `W`, `H` > 0. |
| E4 | Not exactly one valid `bounds` rect, or it lies outside the viewBox. |
| E5 | Fewer than 2 valid `spawn` points. |
| E6 | No valid terrain shape. |
| E7 | No valid `drop` point. |
| E8 | A geometry attribute required by its shape is missing, non-numeric or uses a unit (the element is named). |

**Warnings** (the element is skipped or the default used)

| # | Rule | Fallback |
|---|---|---|
| W1 | Unknown `data-role` value. | Element ignored. |
| W2 | Role on a disallowed element, or a point role on a non-circle. | Element ignored. |
| W3 | `transform` on a role element or its ancestors. | Element ignored. |
| W4 | Unknown or malformed reference ID (material, effect, sound, behavior, item). | Role default from the catalog. |
| W5 | Point (spawn/drop/collectible) outside `bounds`, or a spawn inside solid terrain. | Point ignored. |
| W6 | Fewer than 4 spawn points. | Spawns are shared. |
| W7 | Duplicate `id`. | Later duplicates lose their id. |
| W8 | Setting out of range (`data-cell-size` < 1, `data-gravity` ≤ 0, `data-match-duration` ≤ 0, non-numeric). | Default. |
| W9 | Missing `data-title`. | "Untitled level". |
| W10 | Unknown `data-*` attribute on a role element. | Ignored (forward compatibility). |

The preview kit runs a subset of these checks in the browser and lists them under the legend.

## 8. Versioning and migration

- `data-level-format` is a single integer, bumped only for a **breaking** change (a role, attribute or rule whose meaning changes or disappears).
- **Additive** changes do **not** bump the version: new catalog IDs, new optional attributes, new roles. Older games warn on what they don't know (W1, W10) and keep working.
- The importer keeps one migration per step, `migrate_N_to_N+1(dom)`, operating on the parsed SVG before validation. Importing a file with version `N` runs every step up to the current version. Migrations are pure, tested with a fixture file per old version, and never removed.
- A file newer than the game is rejected with E2 (never guessed at).
- ID renames are not migrations: the catalog's alias entries handle them (§ 6).
- The kit is versioned with the format: `/level-kit/v1/` stays served unchanged for v1 files; a v2 format gets `/level-kit/v2/` beside it.

## 9. Hosted kit

Served from the game's own site under `/level-kit/v1/`:

| File | Purpose |
|---|---|
| `preview.css` | Role colours (overrides the file's own fills for a consistent look), panel layout. |
| `preview.js` | Legend with counts, metadata, point labels, terrain-grid overlay (toggle), soft validation; reads `catalog.json` next to itself to flag unknown IDs. No dependencies. |
| `catalog.json` | Current catalog IDs per kind and the defaults. |
| `AUTHORING.md` | The agent one-pager. |
| `example-level.html` | A complete level using relative kit links (works served or opened from the repo). |

Agent-written levels link the kit with absolute URLs on `https://bompers.tom-fab.workers.dev`, the game's production origin. Without network access the links fail silently and the file is still a correct picture.

## 10. Mapping to the game

The importer (later lap) produces `LevelDefinition`, owned by the engine. Expected mapping: root settings → level settings; viewBox + cell size → terrain grid dimensions; terrain shapes → per-cell solid flag, destructible flag and material ID; points → typed point lists; bounds → a world rectangle; every reference → a resolved catalog ID plus collected warnings.
