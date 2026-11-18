# Design language: Gumdrop Pop

SSOT for how Bompers looks and sounds. The visual pass, HUD and sound tasks follow it. Gameplay rules stay in [`GAME_DESIGN_DOCUMENT.md`](GAME_DESIGN_DOCUMENT.md); when the two disagree on a mechanic, the GDD wins.

**Direction:** Gumdrop Pop (candy palette, sunny sky) with **line style E: silhouette outline only**, plus the flat contact shadow from "Soft Clay".

- The orchestrator picked Gumdrop Pop on 2026-11-14 over "Afterglow" (neon night) and "Soft Clay" (matte, no outlines). In a four-player pile-up under a zoomed-out multi-target camera, a dark edge keeps every blob readable. Flat fills, simple gradients and strokes keep the 60 fps goal safe in PixiJS.
- The owner then chose line style E on 2026-11-14 from six line treatments (thick ink, thin ink, coloured outline, no outline, silhouette only, soft palette). The first version had a thick ink line on every shape. It read well but felt less blob-like. E keeps one crisp edge around the whole character and leaves the inside soft.

**One-line brief:** sticker-bright candy toys under a sunny sky. One dark line around each character's silhouette, no lines inside, a soft body gradient and one white gloss. Everything round.

**Originality:** the look is our own. Do not trace or imitate characters, materials, UI or sounds from LittleBigPlanet, LocoRoco, Fall Guys or any other game. They inspire the feel (bouncy, physical, playful), nothing more.

---

## 1. Palette

All values are sRGB hex. Code reads them from one palette module (owned by the game engine); this table is its source.

### Players

| Player | Body colour      | Helmet emblem | Shade (gradient edge, feet) | Tint (gradient centre, UI fills) |
| ------ | ---------------- | ------------- | --------------------------- | -------------------------------- |
| P1     | `#ff4f3a` tomato | ● circle      | `#ae3c3a`                   | `#ff9e93`                        |
| P2     | `#3069ff` cobalt | ▲ triangle    | `#2e4cb4`                   | `#8dadff`                        |
| P3     | `#ffd43b` lemon  | ■ square      | `#ae8e3b`                   | `#ffe793`                        |
| P4     | `#2ed0a0` mint   | ✚ plus        | `#2d8c79`                   | `#8ce5cb`                        |

Rules:

- **Two cues, always.** A player is told apart by body colour **and** by the helmet emblem. The emblem is drawn in the player colour on the cream helmet, with no outline (§ 3). The same emblem appears on that player's HUD chip, so no one needs colour vision to find themselves.
- **Colour-blind check.** Pairwise CIEDE2000 distance between the four body colours after Machado (2009) simulation at full severity: minimum 17.7 (deuteranopia, P1–P3); normal vision min 37.2; protanopia min 19.4; tritanopia min 23.7. Any change to a player colour must keep every pair ≥ 15 in all four views.
- **Player hues are reserved.** No arena surface, background or pickup uses a player body colour. Effects may borrow them only for that player's own feedback (their rocket fins, their elimination droplets).
- Shade = body mixed 38 % toward ink `#2b1d3a`. Tint = body mixed 45 % toward white. Use these formulas for any new shade.

### World

| Role                                       | Hex                                                                           | Notes                                                                   |
| ------------------------------------------ | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Ink (silhouette outline, pupils, HUD text) | `#2b1d3a`                                                                     | The only outline colour. Never pure black.                              |
| Sky top → bottom                           | `#8fd6ff` → `#fff1cf`                                                         | Vertical linear gradient behind everything.                             |
| Sun                                        | `#fff6a8`                                                                     | Flat disc, no outline.                                                  |
| Clouds                                     | `#ffffff` with `#bfe3f5` 4-unit edge                                          | Far layer: soft edge colour instead of ink, so it reads as background.  |
| Far hills / near hills                     | `#bfe8d0` / `#9fd8b8`                                                         | No outline. Parallax 0.2 / 0.4.                                         |
| Terrain                                    | one swatch per piece (§ Terrain swatches)                                     | Every material uses the same slab look; the swatch is chosen per piece. |
| Ice gloss and rim                          | `#ffffff`                                                                     | Two 45° streaks (60 % alpha) and an inner rim (75 % alpha).             |
| Helmet shell                               | `#fff4e2`; weapon tubes are the same cream, with an accent muzzle light (§ 9) | Same for every player.                                                  |
| Eye white / pupil                          | `#ffffff` / `#2b1d3a`                                                         |                                                                         |
| Contact shadow                             | `#2b1d3a` at 28 % alpha max                                                   | See § 4.                                                                |

### Terrain swatches

Named colours a level puts on any material (`data-color`; catalog kind `color`). Code: `gamePalette.terrainSwatches`.

| ID          | Body      | Lip       | Seam      | Default for |
| ----------- | --------- | --------- | --------- | ----------- |
| `plum`      | `#5a3f7a` | `#7d5fa6` | `#3e2a56` | stone       |
| `slate`     | `#4f6178` | `#71849c` | `#36445a` |             |
| `cardboard` | `#c99a62` | `#ddb682` | `#8f6636` | cardboard   |
| `clay`      | `#c4673f` | `#dc8a62` | `#8c4426` | earth       |
| `moss`      | `#5f8f3e` | `#82b05c` | `#3f6427` |             |
| `mint`      | `#3aa889` | `#67c7aa` | `#247a62` |             |
| `frost`     | `#a8cfe6` | `#dff1fa` | `#6b97b8` | ice         |
| `rose`      | `#c95a86` | `#e384a8` | `#8f3a5d` |             |

### Effects

| Role                                                                                | Hex                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Explosion outer star / mid star / core                                              | `#ff8a1f` / `#ffe14d` / `#ffffff`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Rocket body / nose                                                                  | `#fff4e2` / `#2b1d3a`; fins in the shooter's body colour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Rocket flame                                                                        | `#ffb21a`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Smoke puffs (trail, landing dust)                                                   | `#ffffff`, ink edge at 30–60 % alpha                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Hit flash                                                                           | `#ffffff`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Homing missile body / seeker light / trail                                          | `#c9a7ff` / `#e0103f` (blinks 6 Hz) / `#d9c4ff`; fins in the shooter's body colour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Weapon pickup crate                                                                 | `#fff4e2`; its face shows the weapon's tube silhouette in ink inside a ring in the weapon accent (§ 9)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Point collectible (falls from the roof)                                             | `#ff8fc8` bubblegum star                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Headbutt reset (floats on its point)                                                | `#5fe0ff` aqua diamond crystal, ink outline, white gloss facet, ink up-chevron; while gone, an ink ghost outline at 30 % alpha                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Timer warning (last 10 s)                                                           | `#ff8a1f`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Weapon accents (§ 9)                                                                | rocket launcher sky `#8fd6ff`; homing launcher lilac `#b08cff`; torch ember `#ff8a1f`; freeze ray glacier `#6fc8e8`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Frozen ground (ice-element lap 1; a first take, the owner judges it on the preview) | the `frost` swatch: body `#a8cfe6`, a lip `#dff1fa` on top edges, white gloss streaks at 60 % alpha on about one block in nine. It is drawn in the terrain's own shape, like a fire's body (owner, element-overlay-shape D1): the terrain's curves where it reaches the terrain's edge, a curved edge inside it, the lip one sample deep along its top, inside the terrain's own ink line                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Freeze ray ("Cold breath", owner ice-element D9)                                    | the torch's twin in the ice colours under one ink line: a thin neck that flares and lifts a little, a head of six rolling lobes where it lands (body `#a8cfe6`, lighter inside `#dff1fa`), white snow specks drifting down; on release the head lets go as three rising puffs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Fire ("Sticker flames", owner fire-visuals D1)                                      | pointed flames, ember `#ff6a1a` with an amber `#ffb21a` heart and a pale `#fff1a8` core while fresh, under one ink line (effect width, § 3): drawn in ink first, in colour on top. On terrain a fire is one shape with one ink line (owner fire-clusters D1, "Big flames"): an ember body in the terrain's own shape (the terrain's contour limited to the burning samples, owner element-overlay-shape D1: it follows slab corners, slopes and crater rims and never sticks out past them) with an amber inside where it caught not long ago, and flames on its top edge only, standing on the terrain's edge; flames next to each other pool into fewer, bigger ones, taller with more fire around them and toward the middle of the cluster, each with its own fixed size; a lone flame stays small; scorch `#3a2418` on earth at 40 % alpha; a white smoke puff with an ink edge per burn-out batch |
| Burning blob (fire-burn b2)                                                         | three ember flames with pale-yellow cores on the helmet; sweat drops sky `#8fd6ff`; pinprick pupils (45 %); a drawn panic hop; steam off ice white `#ffffff`; burn-down smoke `#6e6378`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

---

## 2. Shape language

- Everything is built from circles, ellipses and rounded rectangles. The only sharp shape is the explosion star.
- **Blob:** a soft egg, not a perfect circle.
  - Body: half-width R and height 1.94 R (the reference size; R = 30 world units in the style mockup). The widest point sits slightly below the middle, so the bottom is a little fuller and flatter than the top. Build it from four cubic curves (top, two sides, bottom), so squash and stretch deform one smooth shape.
  - Feet: two ellipses 0.4 R × 0.25 R, centred 0.45 R left and right of centre. The body overlaps the top half of each foot, so the feet look tucked under. Fill them with the body shade. Helmet: a dome over the top 45 % of the body, 4 units wider than the body, cream with a white gloss stroke and the emblem in the middle. Weapon tube: a silhouette per weapon on the helmet (§ 9), pivoting toward the aim direction; the rocket tube is a rounded rect (0.76 R × 0.47 R) with a cap. Eyes sit under the helmet rim and look toward the aim direction.
- **Terrain:** every piece, whatever its material, is a big rounded slab (corner radius 14 units) with a lighter lip on top, in its colour swatch. A blast cuts a smoothly curved crater out of a breakable slab (the terrain distance field's contour, terrain-curves D1); a slab no blast has touched keeps its drawn shape. A softer material (lower toughness, e.g. cardboard) opens a wider crater from the same blast.
- **Props and pickups:** chunky and short; nothing thinner than 0.2 R.

### Material behaviour: the rule (owner, material-system D1; terrain-curves D5)

Colour is free: any swatch on any material. Breakable terrain is drawn exactly like solid terrain: one solid colour slab with the same lip and outline, no block, tile or seam pattern (owner, 2026-11-16, superseding the seam-grid cue). Ice keeps its gloss.

|            | Solid (`stone`)             | Breakable (`earth`, `cardboard`)                                                       | Slippery (`ice`)                              |
| ---------- | --------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------- |
| Surface    | smooth, one lip highlight   | the same: smooth, one lip highlight                                                    | two white gloss streaks and a white inner rim |
| Silhouette | one continuous rounded slab | the same slab; craters cut curved edges                                                | the same slab                                 |
| When hit   | nothing changes             | a curved crater opens, swatch-coloured debris flies (an effect, not a lasting pattern) | nothing changes                               |

Never draw gloss on a non-slippery piece, even for decoration. A new behaviour that needs a lasting look gets the owner's sign-off first.

---

## 3. Line and shading (style E: silhouette outline only)

- **Silhouette outline.** Each character gets one ink `#2b1d3a` line around its whole outer shape (body, feet, helmet and rocket tube together), with round joins. There are no lines between the parts inside the silhouette: the helmet meets the body, and the feet meet the body, by colour alone.
- **How to draw it (Pixi):**
  - First draw every part of the character in ink, each part stroked in ink at twice the outline width.
  - Then draw the coloured parts on top with no stroke.
  - Only the outer half of the ink stroke stays visible, which is the silhouette line. That is two passes of the same shapes and no filters.
  - Cache the shape geometry per pose if needed.
- **Width in world units (visible part):** characters 3.5, terrain slab 3.5 (every material), rockets and pickups 2, effect stars 3. Terrain ink follows one rule: the terrain as it stands, grown by the outline width, filled in ink under the fills. Authored edges, crater rims and cut faces get the same line, and where terrain is gone no ink remains (owner, terrain-curves D7–D8).
- **Zoom rule:** the on-screen line is `clamp(worldWidth × zoom, minPx, maxPx)`. Convert back to world width per frame (`screenWidth / zoom`) when drawing. When the camera zooms far out, the line stays readable instead of shrinking to a hairline; zoomed in, it doesn't turn into a thick border.

  | Line                      | world width | minPx | maxPx |
  | ------------------------- | ----------- | ----- | ----- |
  | Characters, solid terrain | 3.5         | 2     | 4.5   |
  | Rockets, pickups          | 2           | 1.2   | 3     |
  | Effect stars              | 3           | 1.5   | 4     |

- **Inner details** (eyes, pupils, the emblem, the helmet gloss stroke) are drawn without outlines, on top of the fills. The emblem is the player colour with no stroke, on the cream helmet.
- **Body shading:**
  - Fill the body with a radial gradient centred at 36 % / 30 % of the body's bounding box (upper left), with radius 0.8 of the box.
  - Stops: tint at 0, body colour at 0.55, shade at 1. Use the tint and shade from the § 1 player table.
  - Cache one gradient per player and reuse it every frame.
  - Add one white gloss oval at 70 % alpha on the upper left of the body: 0.13 R × 0.22 R, tilted 18°.
- **Helmet shading:** vertical linear gradient from `#ffffff` (top) to the helmet shell `#fff4e2` mixed 10 % toward ink (`#eadfd1`, bottom), plus a white gloss stroke along the top of the dome.
- **No gradients elsewhere** on gameplay objects (terrain, rockets, pickups and effects stay flat), apart from the sky.

---

## 4. Contact shadow (borrowed from Soft Clay)

Each blob, pickup and rocket that is airborne gets a flat ellipse on the first ground surface straight below it.

- Colour ink `#2b1d3a`, no blur, no outline.
- `t = min(1, heightAboveGround / 240)` (world units).
- Width = 1.05 × body width × (1 − 0.5 t); height = 12 units × (1 − 0.5 t); alpha = 0.28 × (1 − t).
- No surface within 240 units: no shadow.
- Drawn on the terrain layer, under feet.

---

## 5. Draw order

Back to front:

1. Sky gradient, sun
2. Far hills, clouds, near hills (parallax)
3. Terrain: ink (the standing terrain grown by the outline width), slab fills (breakable slabs clipped to the standing terrain, curved along crater rims)
4. Contact shadows
5. Pickups and collectibles
6. **Effects:** smoke, rocket trails, explosions, debris
7. Rockets
8. **Players** (each with its silhouette outline)
9. Hit flash and respawn ring (on the player, inside its own outline)
10. HUD

**Effects never cover a player outline:** explosions and debris draw under the players (layer 6 is below layer 8). A blob inside an explosion still reads as a clean outlined silhouette on top of the blast. Only the player's own hit flash draws over it, and that flash keeps the silhouette outline.

---

## 6. Motion and squash

Squash and stretch keep area roughly constant (`sx × sy` between 0.93 and 1.01, each axis 0.75–1.25). Numbers are starting values; the movement task tunes them in its config module. Tiers, timing windows and the per-moment channel ledger for all feedback: [`GAME_JUICE.md`](GAME_JUICE.md).

| Moment          | Shape                                                                  | Timing                                  |
| --------------- | ---------------------------------------------------------------------- | --------------------------------------- |
| Landing         | body scale (1.25, 0.75), scaled by impact speed (light landing = half) | recover with back-out overshoot, 180 ms |
| Take-off / jump | (0.85, 1.18)                                                           | ease back to (1, 1) over 150 ms         |
| Wall-jump push  | (0.8, 1.2) rotated toward the wall normal                              | 120 ms                                  |
| Bash hit taken  | (1.15, 0.88) toward the hit, plus knockback                            | 100 ms                                  |
| Idle            | slow breathing, ±3 % on y                                              | 1.6 s loop                              |

- On sloped ground the whole blob (body, helmet, eyes) leans into the hill by 60 % of the slope, at most 30°, easing in on a spring; level in the air (tunables `feel.groundTilt`, slope-walking D4).
- Feet lag the body by 2 frames (about 33 ms) and squash flatter than the body.
- Feet move on their own (tunables `feel.feet`): running, the lifted foot swings forward in an arc and tips its toe up; in the air the feet trail the horizontal speed and droop while rising, flare while falling, with a springy lag; a landing spreads them, a jump pulls them in. While wall-sliding, and a moment after a wall-jump (`wallJumpHoldSeconds`), both feet turn their soles to the wall, the near foot higher.
- The helmet sits on its own spring (it wobbles after landings and shots).
- Rocket fire: the body recoils 4 units away from the aim, tube kicks back 3 units.
- Muzzle ready light (§ 9): after a shot the accent dot on each muzzle drops to 15 % alpha and climbs back to full as the fire cooldown runs out; full = ready to fire.
- **Hit:** 3 frames (50 ms) of white body fill, silhouette outline unchanged, 3 px screen shake for 80 ms.
- **Explosion:** pops in at full size on frame 1 (no fade-in), shrinks and clears in 250 ms; 6 px screen shake for 120 ms. Debris: 5–8 cell-coloured squares with the cell grid-line colour as a thin edge, spinning outward.
- **Elimination:** blob pops into 6 droplets of its body colour plus a small confetti burst, 300 ms.
- **Respawn protection:** body alpha blinks between 100 % and 45 % at 8 Hz, inside a dashed ink ring (radius 1.5 R); the blob is fully playable meanwhile (GDD § 6).
- Reduced motion (OS setting): drop screen shake and idle breathing; keep squash (it carries gameplay information). Built: no shake and a half-strength hit flash; idle breathing still plays.
- Game feel as built (tunables `feel`): back hits flash full white (front 75 %) and shake twice as hard, then hold the world view for 50 ms (hit-stop, render only); tumble bounces shake by bounce speed; live shakes add as a root of squares, capped at 12 px.

---

## 7. HUD and typography

- **Typeface:** Fredoka (OFL), weights 400–700, used for menus, HUD and in-game text.
- **Loading:** one Google Fonts link in `index.html` (`family=Fredoka:wght@400..700&display=swap`), the way the app already loads fonts. Pixi `Text` uses the browser's fonts, so the game waits for `document.fonts.load("700 20px Fredoka")` before creating text objects, or the first labels render in the fallback face. Self-hosting would need a font package (a new dependency); not worth it until offline play matters.
- **Layout (at 1280 × 720, scale with the viewport):** four player cards across the top, two at each side; timer centred between them.
- **Player card:** 228 × 86, white `#fffaf0` fill, one 3 px ink outline around the card (same silhouette idea as the characters), 18 px corners, tilted ±1.5° (alternating). Inside: a 50 × 50 chip in the player colour with the emblem in ink; `P1`…`P4` label (Fredoka 700, 20 px); four health chunks (22 × 20 pills, 7 px corners, no outline); under them, while armed, the ammo row: one 10 px high pill per shot (5 px corners, 3 px gaps) across the health-row width, filled in the weapon accent, spent ones pale `#e9dfd0`, hidden when unarmed; score (Fredoka 700, 30 px) with a small `PTS` caption (600, 11 px, letter-spacing 0.12 em, `#8a7a99`).
- **Health chunks:** full = player colour; lost = pale `#e9dfd0`. A chunk that is lost pops out (scale 1.3 → 0, 150 ms) before the empty pill shows.
- **Timer:** 140 × 70 ink `#2b1d3a` card, lemon `#ffd43b` numerals (Fredoka 700, 42 px). Last 10 seconds: numerals turn `#ff8a1f` and pulse once per second.
- **Menus and app chrome** use the theme tokens below, so buttons, cards and dialogs match the HUD.

### UI theme tokens

`src/shared/theme/tokens/` carries this palette for the app chrome (build: `pnpm tokens:build`; guide: [`DOC_THEMING.md`](../DOC_THEMING.md)). Every text/background pair is at WCAG AA (≥ 4.5:1).

| Token                                      | Light                                                  | Dark                                     |
| ------------------------------------------ | ------------------------------------------------------ | ---------------------------------------- |
| `background` / `foreground`                | `#fff6e6` / `#2b1d3a`                                  | `#1d1428` / `#fff6e6`                    |
| `card`, `popover`                          | `#ffffff`                                              | `#2b1d3a`                                |
| `primary` / `-foreground` (gradient start) | `#5a3f7a` / `#fff6e6` (`#7d5fa6`)                      | `#c3a6ef` / `#2b1d3a` (`#9d7fd0`)        |
| `secondary` / `-foreground`                | `#f4ad55` / `#2b1d3a`                                  | same                                     |
| `muted` / `-foreground`                    | `#f6ebd8` / `#6b5a7d`                                  | `#33254a` / `#c4b6d6`                    |
| `accent`                                   | sky `#8fd6ff` at 35 %                                  | sky at 14 %                              |
| `destructive`                              | `#b42318`                                              | `#ff6b5e`                                |
| `success` / `warning` / `info`             | `#1a7f5a` / `#a8580a` / `#2457c5`                      | `#4fd69f` / `#ffc15e` / `#7fb2ff`        |
| `border` / `input` / `ring`                | ink at 16 % / 40 % / `#5a3f7a`                         | cream at 14 % / 30 % / `#c3a6ef` at 70 % |
| `radius` / `button-radius`                 | 0.75rem / pill                                         | same                                     |
| `elevation-brand`                          | sticker press: 3 px hard ink drop shadow + inset gloss | same with a darker drop                  |

Light mode is the daytime arena; dark mode is the same world at dusk (plum night). The game canvas itself always uses the world palette above, whatever the UI mode.

---

## 8. Audio identity

Which moments get a sound, how loud and when it ducks the music: [`GAME_JUICE.md`](GAME_JUICE.md) § 2, § 5.

**Toy-box pop.** Everything sounds like a squishy, rubbery toy: short, bright, a little silly, never harsh. Explosions are big cartoon "BOOMF"s with a confetti-crackle tail, not realistic bass rumble. Music is upbeat ukulele and marimba with slap bass and hand claps, around 128 BPM, major key, built from short loops plus stingers. Each player's sounds are pitched slightly differently (P1 0, P2 +2, P3 −2, P4 +4 semitones) so four blobs never sound identical. Mix: player actions above music; explosions duck the music by about 4 dB for 300 ms.

**Owner listens first (owner, 2026-11-16).** Every generated audio file (SFX, music loop, stinger, re-take) goes on an artifact page where the owner can play it, as processed for the game (cut, faded, levelled; loops with a loop toggle to hear the seam). It is wired into the game only after the owner approves it there. Links into the generator's own app don't count. If artifacts can't serve the audio from the cloud session, say so and agree another listening path with the owner before wiring.

### SFX set (for the sound task)

| Sound               | Character                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------- |
| Jump                | Short rising rubber "boing", 150–250 ms, light and springy.                                   |
| Land squish         | Soft wet "splut" like a water balloon on a table; louder for bigger falls.                    |
| Bash (unarmed)      | Rubber-mallet "bonk" with a squeaky-toy tail.                                                 |
| Rocket fire         | Cork "pop" plus a short fizzy whoosh.                                                         |
| Explosion           | Cartoon "BOOMF": soft round thump, then a crackle of confetti and pebbles; no harsh high end. |
| Pickup              | Bright two-note marimba "ding-ding" going up.                                                 |
| Hit (taking damage) | Squeaky-toy squeeze, pitched by player, with a soft "oof"-like rubber thud.                   |
| Elimination         | Balloon "pop" followed by a falling slide-whistle and a tiny sad kazoo.                       |
| Respawn             | Bubble "bloop" pop-in with a short sparkle shimmer.                                           |
| Round start         | Three wood-block countdown ticks, then a ukulele strum and a whistle "go".                    |
| Round end           | Short solo-marimba fanfare (the owner dropped the party horn and kazoo on 2026-11-14).        |

### Sound palette (the owner's brief, 2026-11-14)

Every SFX prompt is built from one template: **material + action + palette words + "close-mic, dry, cartoon sound effect"**, with an explicit `duration_seconds` (the generator's floor is 0.5 s; shorter targets are trimmed after generation) and `prompt_influence` 0.6. The palette below is the source of the words and materials; the SFX table above says what each sound does.

| Family     | Sounds                                            | Words                                       | Materials                                       | Space · pitch      | Target lengths                                              |
| ---------- | ------------------------------------------------- | ------------------------------------------- | ----------------------------------------------- | ------------------ | ----------------------------------------------------------- |
| Body       | jump, land, tumble                                | squishy, bouncy, plump                      | rubber ball, gel / jelly                        | dry (10/100) · mid | jump 0.45 s, land 0.45 s, tumble 0.5 s                      |
| Impacts    | dive launch, dive impact, hit, elimination        | bonky, squishy                              | rubber mallet, felt                             | dry (20/100) · mid | launch 0.3 s, impact 0.4 s, hit 0.35 s, elimination 0.55 s  |
| Weapon     | rocket fire, explosion                            | poppy, fizzy, crackly, soft-edged           | cork, paper bag, soda fizz                      | dry (20/100) · mid | rocket fire 0.4 s, explosion 0.85 s                         |
| Round & UI | pickup, respawn, round start, round end           | bright, magical, plinky, bubble, spray      | marimba, bubble                                 | dry (10/100) · mid | pickup 0.4 s, respawn 0.6 s, round start 2 s, round end 2 s |
| Terrain    | stone, earth, cardboard, ice (impact and destroy) | solid, bonky, crumbly, papery, plinky, cool | stone slab, dry earth, cardboard box, ice block | dry · mid          | stone 0.40 s, earth 0.60 s, cardboard 0.40 s, ice 0.45 s    |

**Anchors** (kept takes from the first batch, "more like this"): jump take 3, tumble-bounce take 3, explosion takes 2 and 3, respawn take 2. Kept but not steering: rocket-fire take 3, explosion take 4, pickup takes 1 and 2.

**Banned prompt words:** "toy" (and "rubber toy"): the generator adds squeaky-toy squeaks to anything it touches. Only the newer SFX model is region-locked for this account; prompts target `eleven_text_to_sound_v2`.

**Post-processing** for every file: trim leading and trailing silence, cut to the target length with a short fade-out, loudness-normalise to −16 LUFS, mono, short mp3.

**Chosen takes** (owner, 2026-11-14; files in `public/audio/sfx/`, wiring in `src/features/sound/`): jump, tumble bounce, rocket fire and respawn from the first batch (one take each); explosion 3 takes and pickup 2 takes from the first batch; hit from the test batch; round start, all 4 test takes; land, dive launch, dive impact and elimination from round two; round end, all 6 round-two takes, one picked at random each time. Spares kept for later: dive impact × 2, elimination × 2.

**Material sounds** (owner, 2026-11-16, material-sounds lap): stone `thud` take 4; earth `crumble` take 3 + dive-impact spare 1; cardboard `thwap` take 4; ice `clink` take 2 + dive-impact spare 4. One sound per material, played when it is blasted and, layered over the blob's splut, when a dive bonks into it. The owner's A/B: a wall bonk's blob part is the landing splut; landings keep it. Volume follows intensity: landings by fall speed, hits and bonks by impact speed (GAME_JUICE § 5).

### Music (the music lap, 2026-11-16)

Three tracks, all instrumental, 128 BPM, major key, ukulele + marimba + slap bass + hand claps, generated with `eleven_music_v2_5` (prompts describe the sound only; "no intro or outro so it loops seamlessly" for loops).

| Track | When                                                     | Length              | Character                                                                                        |
| ----- | -------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------ |
| Lobby | the lobby screen                                         | 60 s loop (32 bars) | relaxed, bouncy, cheerful                                                                        |
| Match | a round, until 0:30 left                                 | 60 s loop (32 bars) | driving, cheeky, tight drum groove                                                               |
| Final | the last 30 s of a round, started in time with the clock | 30 s, once          | builds: rising marimba runs, doubling drums, climbing chords, ends on one big bright hit at 0:00 |

No extra round start / end stingers: the round-start and round-end SFX play there. Tracks crossfade over 0.8 s; the round's music fades out when it ends. Explosions duck the music (above). Music and Sounds volumes (0–10) are set in the lobby; M mutes everything.

**Post-processing:** loops cut to exactly 32 bars (60.0 s) with 10–20 ms edge fades so the seam does not click; the final piece cut to 30.0 s with a 150 ms tail fade; one fixed gain to −16 LUFS (no time-varying normaliser, which would bend a loop seam), limiter at −1.5 dBTP, stereo mp3 128 kbps, in `public/audio/music/`.

**Cost:** 15 credits per second of music (60 s = 900).

---

## 9. Weapon identity

The owner picked this system on 2026-11-16 (lap weapon-visuals, direction A of three; the mockup page is not part of the repo). Each question a player asks from the couch has one signal, and it looks the same on the blob, the crate and the HUD.

| Question                      | Signal                                                                                                                                             | Where                                   |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Which one is me?              | Body colour + helmet emblem (§ 1), unchanged                                                                                                       | Blob, HUD chip                          |
| Which team? (team modes only) | Helmet shell: light cream vs dark plum. Light against dark survives every colour-blind view and uses no player hue. Built when a team mode exists. | Helmet, HUD card tab                    |
| Which weapon?                 | **Tube silhouette** on the helmet, one per weapon (part of the ink outline, so it reads at couch zoom) + the weapon **accent**                     | Helmet tube, crate face, HUD ammo pills |
| What's in the crate?          | The same tube silhouette in ink inside a ring in the weapon accent                                                                                 | Crate                                   |
| Shots left?                   | HUD ammo row in the accent (§ 7). No empty-weapon look: the tube disappears at 0 ammo                                                              | HUD                                     |
| Ready to fire?                | An accent light on the muzzle cap fades out while a shot recharges and is full when ready                                                          | Helmet tube                             |

| Weapon                         | Tube silhouette                                                      | Accent            | Projectile                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------ | -------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rocket launcher                | capped tube (§ 2)                                                    | sky `#8fd6ff`     | cream body, ink nose, fins in the shooter colour (§ 1)                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Homing launcher                | twin pod (a short mount and two stacked pods)                        | lilac `#b08cff`   | lilac hull, cherry seeker light blinking 6 Hz, lilac trail, shooter-colour fins (§ 1; owner passed this look with #39)                                                                                                                                                                                                                                                                                                                                                             |
| Torch (fire-spread b1)         | nozzle: a fuel can behind a thin nozzle that flares at the tip       | ember `#ff8a1f`   | an outlined flame from the nozzle while fire is held (owner fire-visuals D2–D3): a neck that opens to about half the hit cone, a head of six rolling lobes, a slight lift toward the end, flames peeling off the top, a flare where it meets terrain (ember outer, amber middle, pale-yellow core; fitted inside the ±18°, 84-unit hit rays). On release the head lets go as one puff; held but idle, a small outlined flame sits on the nozzle. Its HUD pills are seconds of fuel |
| Freeze ray (ice-element lap 1) | emitter: a chunky body, a short neck and a wide flat dish at the tip | glacier `#6fc8e8` | "Cold breath" while fire is held (owner ice-element D9): an outlined ice-blue neck from the emitter that billows into a head of six rolling lobes where it lands, with snow specks drifting down; it follows the middle of the ±3°, 180-unit hit rays, and the head is wider than the line it hits. On release the head lets go as three puffs. Its HUD pills are seconds of charge                                                                                                |

Rules:

- Weapon accents never reuse a player body colour (§ 1 player hues are reserved). The tube shape is the first cue, so an accent close to a player hue (ember vs tomato) stays readable.
- A new weapon adds a tube shape (`src/shared/utils/weaponTube.ts`) and one `weaponLooks` entry (`gamePalette.ts`). The crate, tube and ammo row follow from those two.
- The helmet emblem always stays the player's; weapons never replace it.

---

## Reference mockups

The three direction mockups and the six line-style variants (A–F, with 40 %-zoom thumbnails) were throwaway HTML/SVG pages built during the design-language lap and are not part of the repo. The owner picked variant E from the line-style page. The numbers above are the spec; where a mockup and this file differ, this file wins.
