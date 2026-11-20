# Write a Bompers level (format v2) — agent guide

You are writing **one HTML file** that holds **one inline `<svg>`**. The SVG is the level. Bompers is a 2D side-view arena brawler for 2–4 squishy blob players who fire rockets, rocket-jump and blow up breakable terrain. Full spec: `documentation/game/LEVEL_FORMAT.md` in the Bompers repo. Ready-made prompt with every physics number for one-shot level generation: `/level-kit/v2/LEVEL_PROMPT.md`.

## Rules (all of them)

1. Root: `<svg id="level" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 W H" data-level-format="2" data-title="…">`. The viewBox starts at `0 0`; `W × H` is the world in world units (1 unit ≈ 1 screen pixel at default zoom; 1600 × 1000 is a good arena size). **y points down.**
2. Use only `<rect>`, `<polygon>` and `<circle>` for game shapes. `<g>` is fine for grouping. **No `<path>`, no `transform`** anywhere above a game shape.
3. Every game shape has `data-role`:
   - `terrain` — ground (rect, polygon, circle). What it does comes from `data-material`, how it looks from `data-color`.
   - `object` — a ready-made object (rect; optional): `data-kind="tree"` plus optional `data-variant` (`oak`, `pine`, `snowy-pine`, `palm`, `dead`) and `data-seed`. The game builds it inside the rect, standing on the rect's bottom centre and filling its height; it is solid terrain made of catalog materials (leaves burn, trunks crater). Draw it after the ground it stands on. To stand it on a slope, a wall or a round planet, add `transform="rotate(a cx cy)"` to the rect (the only transform allowed, on the object rect itself): it is built upright in the rect and turned as a whole about `(cx, cy)`. On a planet, draw each object upright on the planet's top and turn it about the planet centre. Kinds, variants and size ranges: § Catalog IDs (`object` rows) and `catalog.json`.
   - `spawn` — player start point (circle; the centre counts). **At least 4.**
   - `drop` — weapons fall from here (circle). **At least 1.** Put them high up.
   - `collectible` — a pickup point (circle). Optional. `data-item="point-orb"` (the default): point orbs fall from the sky onto it. `data-item="dive-reset"`: a **headbutt reset** floats there from the start; a player who has spent their headbutt in the air gets it back by flying through it (gone 2.5 s after use). Hang them in the air between platforms and off edges to make headbutt chains and saves. Never on `drop`.
   - `bounds` — **exactly one** rect: the play area; leaving it eliminates a player.
4. **Material = behaviour, colour = looks.** On every `terrain` shape:
   - `data-material`: `stone` (solid, never breaks; the default), `earth` or `cardboard` (explosions clear it), `ice` (solid and slippery).
   - `data-color` (optional): any named colour from § Catalog IDs, on any material (pink ice, green cardboard, …). Leave it out for the material's own colour. No hex values.
   In the game breakable terrain looks like any slab (one solid colour); only ice shows a pattern (gloss streaks and a white rim). Pick colours that tell materials apart where it matters.
5. Reference other content **by ID only**, never describe it: `data-item` on `collectible`; optional `data-weapons` on the root (space-separated weapon IDs or `none`; leave it out for every weapon). Optional on terrain: `data-effect`, `data-sound`, `data-behavior`. IDs are lowercase-kebab. Every current ID is in § Catalog IDs below (also `/level-kit/v2/catalog.json`).
   Unknown IDs, or an item on the wrong role (a drop item on a `collectible`, a collectible item on a `drop`), don't break the level; they fall back to the default with a warning.
6. Optional level settings on the root: `data-gravity` (multiplier, `1` = normal, `0.6` = floaty), `data-match-duration` (seconds), `data-cell-size` (terrain sample spacing, default `4`). Metadata: `data-author`, `data-agent` (your name, e.g. `claude`, `gemini`, `chatgpt`), `data-level-id`, `data-description`.
7. Give every shape a `fill` so the file looks right with no network. The game ignores `fill`: it paints terrain with `data-color` (the hex per colour is in `catalog.json`).
8. Design sense: spawns sit just above ground (centre ~24 units above the surface), not inside terrain and not over a pit. Leave the side edges open so players can fall off. Keep `bounds` a bit larger than the terrain so players fly before they die. Snap terrain to multiples of 8.

9. **Moving parts (optional):** wrap terrain shapes in `<g data-motion="…">`. Draw them where the part **rests**; the motion is relative to that. `slide 0,-160` (back and forth), `path 160,0 160,-160` (loop through offsets and back), `spin` (full turn per cycle about the `center`), `swing 30` (pendulum ±30° about the `top`). Optional tokens in any order: `6s` (seconds per cycle, default 4, 1–30), `@0.5` (start half a cycle ahead), a pivot (`center`, `top`, `bottom-left`, …), `ccw`. Optional sounds on the same `<g>` (silent by default): `data-move-sound="…"` at its fastest point (a woosh), `data-end-sound="…"` at each turning point; values are `data-sound` IDs. Only terrain moves. A moving part is made of its material like any terrain (blasts crater earth and cardboard parts, fire burns cardboard parts away, stone and ice parts stay whole), and a part that squeezes a player against terrain knocks them out. Over a full cycle a part stays inside bounds, never overlaps other terrain (touching is fine anywhere in the cycle: end a slide flush against a wall for a crusher; a gap under 5.6 units crushes, a wider one only squeezes), keeps 14 units from spawn centres and its fastest point moves at most 340 units/s. Full rules: LEVEL_FORMAT § 11.

Link the preview kit in `<head>` (works offline without it):

```html
<link rel="stylesheet" href="https://bompers.tom-fab.workers.dev/level-kit/v2/preview.css" />
<script src="https://bompers.tom-fab.workers.dev/level-kit/v2/preview.js" defer></script>
```

## Catalog IDs

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

## Minimal valid level

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Tiny Box — Bompers level</title>
    <link rel="stylesheet" href="https://bompers.tom-fab.workers.dev/level-kit/v2/preview.css" />
    <script src="https://bompers.tom-fab.workers.dev/level-kit/v2/preview.js" defer></script>
  </head>
  <body>
    <svg id="level" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"
         data-level-format="2" data-title="Tiny Box" data-agent="claude">
      <rect data-role="bounds" x="0" y="0" width="1200" height="800" fill="none" stroke="#d24b3a" />
      <rect data-role="terrain" x="240" y="560" width="720" height="64" fill="#5a3f7a" />
      <circle data-role="spawn" cx="320" cy="536" r="14" fill="#3f8f5f" />
      <circle data-role="spawn" cx="520" cy="536" r="14" fill="#3f8f5f" />
      <circle data-role="spawn" cx="680" cy="536" r="14" fill="#3f8f5f" />
      <circle data-role="spawn" cx="880" cy="536" r="14" fill="#3f8f5f" />
      <circle data-role="drop" cx="600" cy="80" r="12" fill="#c94f7c" />
    </svg>
  </body>
</html>
```

## Full example

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Floating Garden — Bompers level</title>
    <link rel="stylesheet" href="https://bompers.tom-fab.workers.dev/level-kit/v2/preview.css" />
    <script src="https://bompers.tom-fab.workers.dev/level-kit/v2/preview.js" defer></script>
  </head>
  <body>
    <svg id="level" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000"
         data-level-format="2" data-level-id="floating-garden" data-title="Floating Garden"
         data-author="Bompers team" data-agent="claude"
         data-description="One floating main platform, three raised plateaus, open side edges."
         data-cell-size="4" data-gravity="1" data-match-duration="180"
         style="display:block;width:100%;height:auto;background:#dfe9f2">
      <title>Floating Garden</title>
      <rect data-role="bounds" x="40" y="20" width="1520" height="960" fill="none" stroke="#d24b3a" stroke-width="3" stroke-dasharray="14 8" />
      <g id="terrain">
        <rect id="main-core" data-role="terrain" data-material="stone" data-label="Main platform" x="400" y="640" width="800" height="64" fill="#5a3f7a" />
        <polygon id="main-underside" data-role="terrain" data-material="stone" points="480,704 1120,704 1040,800 560,800" fill="#5a3f7a" />
        <rect id="main-lip-left" data-role="terrain" data-material="earth" x="320" y="640" width="80" height="48" fill="#c4673f" />
        <rect id="main-lip-right" data-role="terrain" data-material="earth" x="1200" y="640" width="80" height="48" fill="#c4673f" />
        <rect id="plateau-left" data-role="terrain" data-material="cardboard" data-label="Left plateau" x="440" y="460" width="240" height="32" fill="#c99a62" />
        <rect id="plateau-right" data-role="terrain" data-material="cardboard" data-color="mint" data-label="Right plateau" x="920" y="460" width="240" height="32" fill="#3aa889" />
        <rect id="plateau-top" data-role="terrain" data-material="ice" x="700" y="300" width="200" height="32" fill="#a8cfe6" />
        <circle id="top-knob" data-role="terrain" data-material="earth" data-color="rose" data-effect="dust-burst" data-sound="crumble" cx="800" cy="300" r="28" fill="#c95a86" />
      </g>
      <g id="spawns">
        <circle data-role="spawn" cx="480" cy="616" r="14" fill="#3f8f5f" />
        <circle data-role="spawn" cx="1120" cy="616" r="14" fill="#3f8f5f" />
        <circle data-role="spawn" cx="560" cy="436" r="14" fill="#3f8f5f" />
        <circle data-role="spawn" cx="1040" cy="436" r="14" fill="#3f8f5f" />
      </g>
      <g id="drops">
        <circle data-role="drop" cx="600" cy="80" r="12" fill="#c94f7c" />
        <circle data-role="drop" cx="1000" cy="80" r="12" fill="#c94f7c" />
      </g>
      <g id="collectibles">
        <circle data-role="collectible" data-item="point-orb" cx="800" cy="160" r="10" fill="#e0b62c" />
        <circle data-role="collectible" data-item="point-orb" cx="320" cy="400" r="10" fill="#e0b62c" />
        <circle data-role="collectible" data-item="point-orb" cx="1280" cy="400" r="10" fill="#e0b62c" />
      </g>
    </svg>
  </body>
</html>
```

## Check before you hand it over

- [ ] One root `<svg>` with `data-level-format="2"`, `data-title` and `viewBox="0 0 W H"`.
- [ ] Exactly one `bounds` rect; ≥ 4 `spawn` circles; ≥ 1 `drop` circle; at least one `terrain` shape.
- [ ] Only rect/polygon/circle carry `data-role`; no `path`, no `transform`.
- [ ] Every terrain shape has a `data-material` (or relies on the `stone` default); colours are catalog names, not hex.
- [ ] Every ID is lowercase-kebab and listed in `catalog.json` (or left out to use the default).
- [ ] Spawns and drops are inside `bounds` and not inside terrain.
- [ ] Each `<g data-motion>` holds only terrain; its sweep stays in bounds, clear of other terrain and spawns.
- [ ] Open the file in a browser: you see the level. With the kit linked, the panel under it lists no problems.
