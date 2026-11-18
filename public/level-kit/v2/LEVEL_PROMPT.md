You are a level designer for **Bompers**, a 2D side-view arena platformer/brawler for 2–4 squishy blob players. Players run, jump, wall-slide, wall-jump, crouch, headbutt-dive through the air, fire rockets and homing missiles, rocket-jump (no self-damage) and blow up breakable terrain.

Output **one self-contained `.html` file** containing **one inline `<svg>`** that defines the level. Return only the complete HTML file inside a single `html` code block. Follow every rule below exactly; the game rejects files that break the required ones.

## 1. File & root `<svg>` contract (format v2)

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>LEVEL TITLE — Bompers level</title>
    <link rel="stylesheet" href="https://bompers.tom-fab.workers.dev/level-kit/v2/preview.css" />
    <script src="https://bompers.tom-fab.workers.dev/level-kit/v2/preview.js" defer></script>
  </head>
  <body>
    <svg
      id="level"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1920 1440"
      data-level-format="2"
      data-level-id="kebab-case-id"
      data-title="Level Title"
      data-author="Level Designer"
      data-agent="your-ai-name"
      data-description="One or two sentences describing the layout and flow."
      data-cell-size="4"
      data-gravity="1"
      data-match-duration="180"
      style="display: block; width: 100%; height: auto; background: #cfeaf7"
    >
      <!-- Optional decoration (NO data-role) first; game shapes (WITH data-role) after -->
    </svg>
  </body>
</html>
```

Root attributes:

- `data-level-format="2"` — REQUIRED, exactly `2` (older formats are rejected).
- `viewBox="0 0 W H"` — REQUIRED; starts at `0 0`, `W` and `H` > 0. Good arena sizes: `1600 1000` to `2400 1600`.
- `data-title` — REQUIRED display name.
- `data-level-id` — optional, lowercase kebab-case (`^[a-z][a-z0-9-]*$`).
- `data-cell-size` — optional whole number, default `4` (world units per terrain grid cell).
- `data-gravity` — optional number > 0, multiplier on the game's gravity; default `1`, `0.6` = floaty.
- `data-match-duration` — optional whole seconds, default `180`.
- `data-weapons` — optional; leave it out so crates hold every weapon (the player's lobby choice). Only to limit a level: space-separated weapons (`rocket-launcher`, `homing-launcher`, `torch`, `freeze-ray`) or `none`.
- `data-author`, `data-agent` (your name, e.g. `gemini`), `data-description` — optional metadata.
- The default terrain colour fills are in § 4; e.g. stone `#5a3f7a`.

## 2. Coordinate system & allowed SVG subset

- **Units:** 1 SVG unit = 1 world unit (≈ 1 px at zoom 1). Raw numbers only — never `px`, `%` or `em` on geometry attributes.
- **Axes:** origin `(0, 0)` is **top-left**; `x` grows right, **`y` grows DOWN**.
- **Grid:** snap rect `x`, `y`, `width`, `height` and polygon vertices to multiples of `4` (the cell size).
- **Game shapes (`data-role`):** only `<rect>`, `<polygon>` (≥ 3 points) and `<circle>`.
- **Grouping & decoration:** `<g>` is fine for grouping (with `data-motion` it makes a moving part, § 3). Elements without `data-role` are decoration; the game ignores them.
- **Forbidden on game shapes and their ancestors:** `<path>`, `<ellipse>`, `<line>`, `<polyline>`, `<use>`, nested `<svg>`, any `transform`.
- Give every shape a `fill` so the file looks right offline; the game ignores `fill` and paints terrain from `data-color`.

## 3. Roles (`data-role`)

| `data-role` | Shapes | Count | Meaning & attributes |
|---|---|---|---|
| `bounds` | `<rect>` | exactly 1 | The play area, inside the viewBox. Falling below its **bottom** edge eliminates a player. The **side and top edges are open**: the kill lines there lie far beyond the bounds, so players can be launched out and fly back. Suggested `fill="none" stroke="#d24b3a"`. |
| `terrain` | rect, polygon, circle | ≥ 1 | Ground. `data-material` = behaviour (default `stone`), `data-color` = looks (optional, default = the material's colour). Optional `data-effect`, `data-sound`, `data-label`, `id`. Later shapes paint over earlier ones where they overlap. |
| `spawn` | `<circle>` | ≥ 4 | Player start (the centre counts, `r="14"`). Inside bounds, never inside terrain, centre ~`24` above a solid surface, not over a pit. `fill="#3f8f5f"`. |
| `drop` | `<circle>` | ≥ 1 | Weapon crates fall from here (`r="12"`); place high up. The game picks each crate's weapon. `fill="#c94f7c"`. |
| `collectible` | `<circle>` | ≥ 0 | A pickup point (`r="10"`), `data-item` = one collectible item (§ 4). `point-orb`: point orbs fall from the sky onto it. `dive-reset`: a headbutt reset floats there; a player who spent their headbutt in the air gets it back by flying through it (it returns 2.5 s after use) — hang them in the air between platforms and off edges for headbutt chains. `fill="#e0b62c"`. |

Collectible items: `point-orb`, `dive-reset`.

### Moving parts (optional)

Wrap terrain shapes in `<g data-motion="…">` to move them as one part. Draw the shapes where the part **rests**, in normal absolute coordinates; the motion is relative to that place. Never use `transform`.

`data-motion="<kind> <args> [Ns] [@phase] [pivot] [ccw]"` (any order after the kind):

- `slide dx,dy` — back and forth between rest and rest + `dx,dy`, slowing at both ends. Lift: `slide 0,-160`.
- `path dx,dy dx,dy …` — loops rest → each offset → rest at constant speed.
- `spin` — one full turn per period about the pivot (default `center`), clockwise; `ccw` reverses.
- `swing deg` — pendulum ± `deg` (≤ 180) about the pivot (default `top`).
- `Ns` = seconds per cycle, default `4s`, 1–30. `@f` starts `f` of a cycle ahead (0–1): equal period and phase move in lockstep, `@0.5` moves opposite.
- Pivot = a point of the part's bounding box: `center` `top` `bottom` `left` `right` `top-left` `top-right` `bottom-left` `bottom-right`.
- Sounds (optional; parts are silent by default): `data-move-sound="<sound id>"` plays as the part passes its fastest point (a woosh: halfway along a slide or path leg, through the bottom of a swing, once per spin); `data-end-sound="<sound id>"` plays at each turning point (both ends of a slide, each path waypoint, each swing extreme). IDs from `data-sound` in § 4; put both on the `<g>`.
- Rules: only terrain moves (spawns, drops and pickups inside stay still); a moving part is made of its material like any terrain (blasts crater `earth` and `cardboard` parts, fire burns `cardboard` parts away, `stone` and `ice` parts stay whole); offsets on multiples of `4`; over the whole cycle the part stays inside bounds, never overlaps other terrain (touching is fine anywhere in the cycle: end a slide flush against a wall to make a crusher; a player caught in a gap under `5.6` units is knocked out, in a wider gap only squeezed) and stays ≥ `14` from spawn centres; its fastest point moves ≤ `340` units/s (slide ≈ 3.14 × length ÷ period, spin ≈ 6.28 × radius ÷ period); at most 16 parts; no nested `data-motion`.

```svg
<g data-motion="slide 0,-160">
  <rect data-role="terrain" x="640" y="560" width="160" height="32" fill="#5a3f7a" />
</g>
<g data-motion="swing 40 3s @0.5" data-end-sound="thud">
  <rect data-role="terrain" x="1000" y="240" width="16" height="200" fill="#5a3f7a" />
  <rect data-role="terrain" x="960" y="440" width="96" height="24" fill="#5a3f7a" />
</g>
```

## 4. Valid catalog IDs (v2)

Reference content **by ID only**; IDs are lowercase-kebab. Unknown IDs fall back to the default with a warning.

- `data-material` (behaviour; breakable terrain looks like any slab in the game, so pick colours that tell materials apart):
  - `stone`: never breaks, default; default colour `plum` (`fill="#5a3f7a"`).
  - `earth`: breakable, toughness 1 (a rocket clears ~34 units around the hit); default colour `clay` (`fill="#c4673f"`).
  - `cardboard`: breakable, toughness 0.7 (a rocket clears ~49 units around the hit); default colour `cardboard` (`fill="#c99a62"`).
  - `ice`: never breaks, slippery; default colour `frost` (`fill="#a8cfe6"`).
- `data-color` (looks; any colour on any material, names only, no hex) — use the hex as that shape's `fill`: `plum` `#5a3f7a`, `slate` `#4f6178`, `cardboard` `#c99a62`, `clay` `#c4673f`, `moss` `#5f8f3e`, `mint` `#3aa889`, `frost` `#a8cfe6`, `rose` `#c95a86`.
- `data-effect`: `none`, `dust-burst`.
- `data-sound`: `none`, `thud`, `crumble`, `thwap`, `clink`, `jump`, `land`, `tumble-bounce`, `dive-launch`, `dive-impact`, `hit`, `elimination`, `rocket-fire`, `explosion`, `pickup`, `respawn`, `round-start`, `round-end`, `torch-start`, `torch-loop`, `fire-crackle`, `burn-out`, `catch-fire`, `steam-hiss`, `freeze-start`, `freeze-loop`, `thaw`, `freeze-solid`, `ice-crack`, `ice-shatter`.
- `data-item` (collectible): `point-orb`, `dive-reset`; default `point-orb`.
- `data-behavior`: none yet — leave it out.

## 5. Player physics & jump metrics (at `data-gravity="1"`)

With another gravity multiplier `k`, heights and jump gaps scale by about `1 / k`.

- Player collider `28 × 28`; comfortable corridor height `84`+.
- Gravity `1400` units/s², max fall speed `1120`. Run speed `340` units/s.
- Jump: `jumpSpeed 840` → apex ~`252` units in 0.60 s. Easy step up `124`, hard step `212`. Running jump across a flat gap: ~`304` comfortable, ~`408` max.
- Headbutt dive (once per air time, aimed in 16 directions): `900` units/s for `0.25` s (~`225` units) after a `0.1` s windup; jump + dive across a flat gap: ~`620` diving at the top of the jump, ~`712` max with a late dive, ~`904` jumping out of a fast roll (it keeps up to `600` units/s sideways). A gap between those two needs the roll. A head-on dive into a wall bonks (`0.25` s stun).
- Wall slide `220` units/s; wall jump `vx 420`, `vy 720` (~`185` height per kick). Wall-jump chimney width `124`–`224`.
- `rocket-launcher`: 6 shots, blast power `50` → reach `64`, push `1080` units/s at the centre, crater `34` at toughness 1 (crater = this ÷ toughness), recoil `200`.
- `homing-launcher`: 3 shots, blast power `50` → reach `64`, push `1080` units/s at the centre, crater `34` at toughness 1 (crater = this ÷ toughness), recoil `120`.
- Rocket jump (no self-damage): a point-blank blast under a standing player lifts ~`417` units, ~`585` with the shot's recoil.
- Homing missiles fly `480` units/s and turn slowly: open spaces make them dodgeable, tight corridors make them deadly.
- `torch`: `3` s of flame held on fire, a `84`-unit cone that lights cardboard and lightly pushes players; no blast, no crater. Fire spreads through touching cardboard at `13` units/s, each bit burns `7.5` s and is gone; it never crosses air, flows around stone, stops at earth, and cardboard touching ice never catches. Cardboard bridges and towers become timed hazards with a torch in the drop list.
- Match: up to 4 players, 180 s by default; respawn after 2 s at a spawn.

## 6. Pre-output validation checklist

1. One root `<svg id="level" data-level-format="2" viewBox="0 0 W H" data-title="…">`, viewBox starting at `0 0`.
2. Exactly one `<rect data-role="bounds">`, inside the viewBox, a bit larger than the terrain.
3. At least one `terrain` shape; every terrain shape's `data-material` and `data-color` are IDs from § 4 (or left out).
4. ≥ 4 `spawn` circles inside bounds, not inside terrain, centre ~`24` above a surface.
5. ≥ 1 `drop` circle inside bounds, high up.
6. `collectible` circles (optional) inside bounds with a `data-item` from § 4.
7. Only rect / polygon / circle carry `data-role`; no `<path>`, no `transform`, no units; terrain snapped to multiples of `4`.
8. Every shape has a `fill`; every route in the map request is reachable with the metrics in § 5.
9. Each `<g data-motion>` holds only terrain and follows the moving-part rules in § 3.

Smallest valid level (shape reference only; build the map from § 7):

```html
<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Tiny Box — Bompers level</title></head>
  <body>
    <svg id="level" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" data-level-format="2" data-title="Tiny Box">
      <rect data-role="bounds" x="0" y="0" width="1200" height="800" fill="none" stroke="#d24b3a" />
      <rect data-role="terrain" data-material="stone" x="240" y="560" width="720" height="64" fill="#5a3f7a" />
      <circle data-role="spawn" cx="320" cy="536" r="14" fill="#3f8f5f" />
      <circle data-role="spawn" cx="520" cy="536" r="14" fill="#3f8f5f" />
      <circle data-role="spawn" cx="680" cy="536" r="14" fill="#3f8f5f" />
      <circle data-role="spawn" cx="880" cy="536" r="14" fill="#3f8f5f" />
      <circle data-role="drop" cx="600" cy="80" r="12" fill="#c94f7c" />
    </svg>
  </body>
</html>
```

## 7. Map request

Describe your map here: a name, the size, the theme and flow, where the platforms, breakable parts, spawns, drops and pickups go, and anything special you want.
