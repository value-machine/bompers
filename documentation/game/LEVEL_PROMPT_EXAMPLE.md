# Level-generation prompt — owner example

Reference for the backlog task **Copyable level-generation prompt**. The owner wrote this example (2026-11-16) against level format v1. It shows the shape the in-app copyable prompt should take; its facts are stale where later laps change them (material system → format v2 and materials/colours, slower jumps → gravity and jump metrics, open map edges → bounds no longer lethal on sides/top nearby, headbutt reset power-up → new role). The lap generates sections 1–6 from the live format, catalog and tunables instead of hardcoding numbers, and leaves section 7 (the map request) for the user.

Owner note on the task: "alleen de variabele settings hierin" (only the variable settings in it). Read as: the full prompt with every game-dependent value filled in live (owner, level-gen-prompt D1).

**Superseded:** the live prompt is built by `src/features/level-kit/services/levelPrompt.ts`, copied by the lobby's "Copy AI prompt" button and generated to [`public/level-kit/v2/LEVEL_PROMPT.md`](../../public/level-kit/v2/LEVEL_PROMPT.md). This file stays as the owner's original for reference only.

---

You are a level designer for **Bompers**, a 2D side-view arena platformer/brawler for 2–4 squishy blob players. Players run, jump, wall-slide, wall-jump, directional-dive (air-dash/headbutt), fire rockets, rocket-jump (no self-damage), and blow up destructible terrain.

Output **one self-contained `.html` file** containing **one inline `<svg>`** that defines the level. Return only the complete HTML file inside a single `html` code block.

## 1. File & Root `<svg>` Contract (Format v1)

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>LEVEL TITLE — Bompers level</title>
    <link rel="stylesheet" href="https://bompers.tom-fab.workers.dev/level-kit/v1/preview.css" />
    <script src="https://bompers.tom-fab.workers.dev/level-kit/v1/preview.js" defer></script>
  </head>
  <body>
    <svg
      id="level"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1920 1440"
      data-level-format="1"
      data-level-id="kebab-case-id"
      data-title="Level Title"
      data-author="Level Designer"
      data-agent="ai-agent"
      data-description="One or two sentences describing the layout and flow."
      data-cell-size="8"
      data-gravity="1"
      data-match-duration="180"
      style="display: block; width: 100%; height: auto; background: #cfeaf7"
    >
      <!-- Optional decorative elements (NO data-role) go first -->
      <!-- Game elements (WITH data-role) go here -->
    </svg>
  </body>
</html>
```

### Root Attributes

- `data-level-format="1"` (REQUIRED, integer `1`)
- `viewBox="0 0 W H"` (REQUIRED, must start at `0 0`, `W` and `H` > 0; typical sizes: `1600 1000` to `2400 1600`)
- `data-title` (REQUIRED, display name)
- `data-level-id` (optional, lowercase kebab-case `^[a-z][a-z0-9-]*$`)
- `data-cell-size` (optional integer, default `8` world units per terrain grid cell)
- `data-gravity` (optional number > 0, multiplier on base gravity; `1` = normal, `0.75` = floaty)
- `data-match-duration` (optional integer seconds, default `180`)
- `data-author`, `data-agent`, `data-description` (optional metadata strings)

## 2. Coordinate System & Allowed SVG Subset

- **Units:** 1 SVG unit = 1 world unit (≈ 1 px at zoom 1). Raw numbers only — never put `px`, `%`, or `em` on geometry attributes.
- **Axes:** Origin `(0, 0)` is **top-left**. `x` increases right, **`y` increases DOWN**.
- **Grid alignment:** Snap rectangle `x`, `y`, `width`, `height` and polygon vertices to multiples of `8`.
- **Allowed elements for `[data-role]`:** `<rect>`, `<polygon>` (≥ 3 points, non-zero winding), `<circle>`.
- **Grouping & Decoration:** `<g>` only without `transform` and `data-role`. Elements without `data-role` are decoration, ignored by the importer.
- **Forbidden on `[data-role]` elements and their ancestors:** `<path>`, `<ellipse>`, `<line>`, `<polyline>`, `<use>`, nested `<svg>`, any `transform`.

## 3. Roles (`data-role`) & Overlap Rules

| `data-role` | Allowed Shapes | Required Count | Meaning & Attributes |
|---|---|---|---|
| `bounds` | `<rect>` | Exactly 1 | Playable area inside `viewBox`. Leaving `bounds` eliminates a player. |
| `platform` | rect, polygon, circle | ≥ 1 | Indestructible solid terrain. Optional `data-material="stone"`, `data-label`. |
| `destructible` | rect, polygon, circle | ≥ 0 | Breakable terrain cleared by rocket blasts (crater radius `34`). Optional `data-material="dirt"`, `data-effect`, `data-sound`, `data-label`. |
| `spawn` | `<circle>` | ≥ 4 (min 2) | Player spawn (`r="14"`), inside bounds, never inside terrain, ~`24` above a solid platform. |
| `drop` | `<circle>` | ≥ 1 | Sky weapon spawner (`r="12"`, `y ≈ 120–200`), `data-items="rocket-launcher"`. |
| `collectible` | `<circle>` | ≥ 0 | Point orb anchor (`r="10"`), `data-item="point-orb"`. |

`platform` wins over `destructible` where they overlap. Give every shape a `fill` (palette: stone `#5a3f7a`, dirt `#f4ad55`, outline `#2b1d3a`, bounds stroke `#d24b3a`, spawn `#3f8f5f`, drop `#c94f7c`, collectible `#e0b62c`).

## 4. Valid Catalog IDs (v1)

- `data-material`: `stone`, `dirt`
- `data-effect`: `none`, `dust-burst`
- `data-sound`: `none`, `thud`, `crumble`, `jump`, `land`, `tumble-bounce`, `dive-launch`, `dive-impact`, `hit`, `elimination`, `rocket-fire`, `explosion`, `pickup`, `respawn`, `round-start`, `round-end`
- `data-items` (drop): `rocket-launcher`; `data-item` (collectible): `point-orb`; `data-behavior`: none in v1.

## 5. Player Physics & Jump Metrics (at `data-gravity="1"`)

- Player collider `28 × 28`; comfortable corridor clearance `64–80`.
- Run speed `340` units/s.
- Standard jump: apex ~`250` (`jumpSpeed = 1050`, `gravity = 2200`); easy step `96–144`; hard step `168–216`; running jump ~`320` comfortable, ~`380` max.
- Dive: `900` units/s for `0.25s` (~`225` units) with `0.1s` windup; jump + dive gap ~`420–500`; head-on wall dive = `0.25s` bonk stun.
- Wall slide `220` units/s; wall-jump `vx = 420`, `vy = 900` (~`184` gain per kick, `0.16s` lock); chimney width `128–224`.
- Rocket jump: explosion radius `64`, crater `34`, impulse `1350`, no self-damage; standing apex ~`410`.

## 6. Pre-Output Validation Checklist

1. Single `<svg id="level" data-level-format="1" viewBox="0 0 W H" data-title="…">`.
2. Exactly 1 `<rect data-role="bounds">` inside `0 0 W H`.
3. ≥ 4 spawns inside bounds, `24` above platform surfaces, not overlapping terrain.
4. ≥ 1 `drop` with `data-items="rocket-launcher"` inside bounds.
5. No `<path>`, no `transform`, no units, terrain snapped to multiples of `8`.

## 7. Map Request

Create a **Jump Challenge** arena map (`data-level-id="sky-gauntlet"`, `data-title="Sky Gauntlet"`, `viewBox="0 0 2240 1600"`, `data-gravity="1"`):

- **Theme & Flow:** a vertical and horizontal parkour arena in the sky; players race and brawl upward from lower starting islands toward a high central summit crown.
- **Bottom Zone (`y ≈ 1248`):** two wide symmetrical stone islands (`width ≈ 384`), each with a destructible dirt lip and 2 spawns. A `320`-unit center gap bridged by a small destructible stepping stone (blow it away to force `448`-unit jump+dive crossings).
- **Mid Tier (`y ≈ 1040`–`880`):** small stone pillars (`width 64–96`) and thin platforms, `160–192` apart vertically and `240–320` horizontally; thin dirt caps on several pillars.
- **Upper Tier (`y ≈ 848`–`496`):** left and right stone wall-jump chimneys (`160` wide) climbing `352` units, each plugged at the top with narrow destructible dirt.
- **Apex Summit (`y ≈ 448`):** a central stone crown (`width 192`) with dirt wings, reached via the chimneys + a `360`-unit dive, or a rocket-jump from the mid tier.
- **Drops & Collectibles:** 5 drops at `y = 144` over the islands, chimneys and summit; 8 point orbs in risky parkour spots (jump arcs, chimneys, above the crown at `y = 280`, and one below the center gap at `y = 1360`).
