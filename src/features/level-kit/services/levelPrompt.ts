import {
  CATALOG_DEFAULTS,
  LEVEL_FORMAT_VERSION,
  exportCatalog,
  type ExportedCatalog,
} from "@/features/content-catalog/api/contentCatalogApi";
import { MIN_SPAWNS, RECOMMENDED_SPAWNS } from "@/features/level-file/api/levelFileApi";
import { DEFAULT_GAME_TUNABLES, type GameTunables } from "@/shared/config/gameTunables";
import { terrainSwatch, toCssColor } from "@/shared/config/gamePalette";
import { blastPushAt, blastReach, craterReach } from "@/shared/utils/blastPower";
import { MOTION_DEFAULTS, MOTION_LIMITS, MOTION_PIVOTS } from "@/shared/utils/levelMotion";

/**
 * The copyable level-generation prompt (feedback round 2 § 2.1, level-gen-prompt D1): one text a
 * player pastes into any AI agent to get a valid, playable level file in one shot. Sections 1–6
 * are built from the live format version, content catalog, level defaults and game tunables, so
 * the prompt follows the game when those change; section 7 is left for the player's map wish.
 * Shape: the owner's example, documentation/game/LEVEL_PROMPT_EXAMPLE.md. Pure: no DOM.
 */

/** Where the hosted level kit lives (level-file-format D14). */
export const LEVEL_KIT_ORIGIN = "https://bompers.tom-fab.workers.dev";
const KIT_URL = `${LEVEL_KIT_ORIGIN}/level-kit/v${LEVEL_FORMAT_VERSION}`;

/** Suggested `fill` for point roles and bounds; the game ignores fill (preview only). */
const PREVIEW_FILLS = {
  bounds: "#d24b3a",
  spawn: "#3f8f5f",
  drop: "#c94f7c",
  collectible: "#e0b62c",
} as const;

/** Preview `r` per point role (the centre is what counts). */
const POINT_RADIUS = { spawn: 14, drop: 12, collectible: 10 } as const;

const round = (n: number): number => Math.round(n);
const code = (s: string | number): string => `\`${s}\``;
const codeList = (ids: readonly string[]): string => ids.map((id) => code(id)).join(", ");
const snapDown = (n: number, cell: number): number => Math.floor(n / cell) * cell;

/** Units a centred spawn sits above the surface: half a body plus a small gap. */
const spawnLift = (t: GameTunables): number => t.player.height / 2 + 10;

const materialFill = (catalog: ExportedCatalog, materialId: string): string => {
  const material = catalog.material.find((m) => m.id === materialId);
  return toCssColor(terrainSwatch(material?.defaultColor ?? "").fill);
};

interface PromptContext {
  catalog: ExportedCatalog;
  tunables: GameTunables;
  cell: number;
}

function renderIntro(): string {
  return [
    "You are a level designer for **Bompers**, a 2D side-view arena platformer/brawler for 2–4 squishy blob players. Players run, jump, wall-slide, wall-jump, crouch, headbutt-dive through the air, fire rockets and homing missiles, rocket-jump (no self-damage) and blow up breakable terrain.",
    "",
    "Output **one self-contained `.html` file** containing **one inline `<svg>`** that defines the level. Return only the complete HTML file inside a single `html` code block. Follow every rule below exactly; the game rejects files that break the required ones.",
  ].join("\n");
}

function renderFileContract({ catalog, cell }: PromptContext): string {
  const v = LEVEL_FORMAT_VERSION;
  return [
    `## 1. File & root \`<svg>\` contract (format v${v})`,
    "",
    "```html",
    "<!doctype html>",
    '<html lang="en">',
    "  <head>",
    '    <meta charset="utf-8" />',
    "    <title>LEVEL TITLE — Bompers level</title>",
    `    <link rel="stylesheet" href="${KIT_URL}/preview.css" />`,
    `    <script src="${KIT_URL}/preview.js" defer></script>`,
    "  </head>",
    "  <body>",
    "    <svg",
    '      id="level"',
    '      xmlns="http://www.w3.org/2000/svg"',
    '      viewBox="0 0 1920 1440"',
    `      data-level-format="${v}"`,
    '      data-level-id="kebab-case-id"',
    '      data-title="Level Title"',
    '      data-author="Level Designer"',
    '      data-agent="your-ai-name"',
    '      data-description="One or two sentences describing the layout and flow."',
    `      data-cell-size="${cell}"`,
    `      data-gravity="${CATALOG_DEFAULTS.gravity}"`,
    `      data-match-duration="${CATALOG_DEFAULTS.matchDuration}"`,
    '      style="display: block; width: 100%; height: auto; background: #cfeaf7"',
    "    >",
    "      <!-- Optional decoration (NO data-role) first; game shapes (WITH data-role) after -->",
    "    </svg>",
    "  </body>",
    "</html>",
    "```",
    "",
    "Root attributes:",
    "",
    `- \`data-level-format="${v}"\` — REQUIRED, exactly \`${v}\` (older formats are rejected).`,
    '- `viewBox="0 0 W H"` — REQUIRED; starts at `0 0`, `W` and `H` > 0. Good arena sizes: `1600 1000` to `2400 1600`.',
    "- `data-title` — REQUIRED display name.",
    "- `data-level-id` — optional, lowercase kebab-case (`^[a-z][a-z0-9-]*$`).",
    `- \`data-cell-size\` — optional whole number, default \`${cell}\` (world units per terrain grid cell).`,
    `- \`data-gravity\` — optional number > 0, multiplier on the game's gravity; default \`${CATALOG_DEFAULTS.gravity}\`, \`0.6\` = floaty.`,
    `- \`data-match-duration\` — optional whole seconds, default \`${CATALOG_DEFAULTS.matchDuration}\`.`,
    "- `data-author`, `data-agent` (your name, e.g. `gemini`), `data-description` — optional metadata.",
    `- The default terrain colour fills are in § 4; e.g. stone \`${materialFill(catalog, CATALOG_DEFAULTS.material)}\`.`,
  ].join("\n");
}

function renderCoordinates({ cell }: PromptContext): string {
  return [
    "## 2. Coordinate system & allowed SVG subset",
    "",
    "- **Units:** 1 SVG unit = 1 world unit (≈ 1 px at zoom 1). Raw numbers only — never `px`, `%` or `em` on geometry attributes.",
    "- **Axes:** origin `(0, 0)` is **top-left**; `x` grows right, **`y` grows DOWN**.",
    `- **Grid:** snap rect \`x\`, \`y\`, \`width\`, \`height\` and polygon vertices to multiples of \`${cell}\` (the cell size).`,
    "- **Game shapes (`data-role`):** only `<rect>`, `<polygon>` (≥ 3 points) and `<circle>`.",
    "- **Grouping & decoration:** `<g>` is fine for grouping (with `data-motion` it makes a moving part, § 3). Elements without `data-role` are decoration; the game ignores them.",
    "- **Forbidden on game shapes and their ancestors:** `<path>`, `<ellipse>`, `<line>`, `<polyline>`, `<use>`, nested `<svg>`, any `transform`.",
    "- Give every shape a `fill` so the file looks right offline; the game ignores `fill` and paints terrain from `data-color`.",
  ].join("\n");
}

function renderRoles(ctx: PromptContext): string {
  const { catalog, tunables } = ctx;
  const respawn = tunables.collectibles.diveRefill.respawnSeconds;
  const lift = spawnLift(tunables);
  return [
    "## 3. Roles (`data-role`)",
    "",
    "| `data-role` | Shapes | Count | Meaning & attributes |",
    "|---|---|---|---|",
    `| \`bounds\` | \`<rect>\` | exactly 1 | The play area, inside the viewBox. Falling below its **bottom** edge eliminates a player. The **side and top edges are open**: the kill lines there lie far beyond the bounds, so players can be launched out and fly back. Suggested \`fill="none" stroke="${PREVIEW_FILLS.bounds}"\`. |`,
    `| \`terrain\` | rect, polygon, circle | ≥ 1 | Ground. \`data-material\` = behaviour (default \`${CATALOG_DEFAULTS.material}\`), \`data-color\` = looks (optional, default = the material's colour). Optional \`data-effect\`, \`data-sound\`, \`data-label\`, \`id\`. Later shapes paint over earlier ones where they overlap. |`,
    `| \`spawn\` | \`<circle>\` | ≥ ${RECOMMENDED_SPAWNS} (min ${MIN_SPAWNS}) | Player start (the centre counts, \`r="${POINT_RADIUS.spawn}"\`). Inside bounds, never inside terrain, centre ~\`${lift}\` above a solid surface, not over a pit. \`fill="${PREVIEW_FILLS.spawn}"\`. |`,
    `| \`drop\` | \`<circle>\` | ≥ 1 | Weapon crates fall from here (\`r="${POINT_RADIUS.drop}"\`); place high up. \`data-items\` = space-separated drop items (§ 4). \`fill="${PREVIEW_FILLS.drop}"\`. |`,
    `| \`collectible\` | \`<circle>\` | ≥ 0 | A pickup point (\`r="${POINT_RADIUS.collectible}"\`), \`data-item\` = one collectible item (§ 4). \`point-orb\`: point orbs fall from the sky onto it. \`dive-reset\`: a headbutt reset floats there; a player who spent their headbutt in the air gets it back by flying through it (it returns ${respawn} s after use) — hang them in the air between platforms and off edges for headbutt chains. \`fill="${PREVIEW_FILLS.collectible}"\`. |`,
    "",
    `Drop items: ${codeList(itemIds(catalog, "drop"))}. Collectible items: ${codeList(itemIds(catalog, "collectible"))}.`,
  ].join("\n");
}

/** A worked moving-part snippet: a lift drawn at rest that rises 160 and back. */
function movingPartExample({ catalog }: PromptContext): string {
  const fill = materialFill(catalog, CATALOG_DEFAULTS.material);
  return [
    "```svg",
    '<g data-motion="slide 0,-160">',
    `  <rect data-role="terrain" x="640" y="560" width="160" height="32" fill="${fill}" />`,
    "</g>",
    '<g data-motion="swing 40 3s @0.5">',
    `  <rect data-role="terrain" x="1000" y="240" width="16" height="200" fill="${fill}" />`,
    `  <rect data-role="terrain" x="960" y="440" width="96" height="24" fill="${fill}" />`,
    "</g>",
    "```",
  ].join("\n");
}

/** Moving parts (LEVEL_FORMAT § 11): grammar, defaults, alignment rules, one example. */
function renderMovingParts(ctx: PromptContext): string {
  const { periodS, pivot } = MOTION_DEFAULTS;
  const lim = MOTION_LIMITS;
  const pivots = Object.keys(MOTION_PIVOTS)
    .map((p) => code(p))
    .join(" ");
  return [
    "### Moving parts (optional)",
    "",
    'Wrap terrain shapes in `<g data-motion="…">` to move them as one part. Draw the shapes where the part **rests**, in normal absolute coordinates; the motion is relative to that place. Never use `transform`.',
    "",
    '`data-motion="<kind> <args> [Ns] [@phase] [pivot] [ccw]"` (any order after the kind):',
    "",
    "- `slide dx,dy` — back and forth between rest and rest + `dx,dy`, slowing at both ends. Lift: `slide 0,-160`.",
    "- `path dx,dy dx,dy …` — loops rest → each offset → rest at constant speed.",
    `- \`spin\` — one full turn per period about the pivot (default ${code(pivot.spin)}), clockwise; \`ccw\` reverses.`,
    `- \`swing deg\` — pendulum ± \`deg\` (≤ ${lim.maxSwingDegrees}) about the pivot (default ${code(pivot.swing)}).`,
    `- \`Ns\` = seconds per cycle, default \`${periodS}s\`, ${lim.minPeriodS}–${lim.maxPeriodS}. \`@f\` starts \`f\` of a cycle ahead (0–1): equal period and phase move in lockstep, \`@0.5\` moves opposite.`,
    `- Pivot = a point of the part's bounding box: ${pivots}.`,
    `- Rules: only terrain moves (spawns, drops and pickups inside stay still); moving parts never break; offsets on multiples of \`${ctx.cell}\`; over the whole cycle the part stays inside bounds, keeps an \`8\`-unit margin from other terrain (touching at rest is fine) and stays ≥ \`${lim.spawnClearance}\` from spawn centres; its fastest point moves ≤ \`${lim.rideSpeed}\` units/s (slide ≈ 3.14 × length ÷ period, spin ≈ 6.28 × radius ÷ period); at most ${lim.maxMovers} parts; no nested \`data-motion\`.`,
    "",
    movingPartExample(ctx),
  ].join("\n");
}

const itemIds = (catalog: ExportedCatalog, use: "drop" | "collectible"): string[] =>
  catalog.item.filter((item) => item.use === use).map((item) => item.id);

function materialLine(ctx: PromptContext, material: ExportedCatalog["material"][number]): string {
  const facts: string[] = [];
  if (material.toughness === null) facts.push("never breaks");
  else {
    const crater = craterReach(ctx.tunables, ctx.tunables.combat.rocket.power) / material.toughness;
    facts.push(
      `breakable, toughness ${material.toughness} (a rocket clears ~${round(crater)} units around the hit)`
    );
  }
  if (material.friction < 1) facts.push("slippery");
  if (material.id === CATALOG_DEFAULTS.material) facts.push("default");
  const fill = materialFill(ctx.catalog, material.id);
  return `  - ${code(material.id)}: ${facts.join(", ")}; default colour ${code(material.defaultColor)} (\`fill="${fill}"\`).`;
}

function renderCatalog(ctx: PromptContext): string {
  const { catalog } = ctx;
  const colours = catalog.color.map(
    (c) => `${code(c.id)} \`${toCssColor(terrainSwatch(c.id).fill)}\``
  );
  const behaviors = catalog.behavior.map((b) => b.id);
  return [
    `## 4. Valid catalog IDs (v${LEVEL_FORMAT_VERSION})`,
    "",
    "Reference content **by ID only**; IDs are lowercase-kebab. Unknown IDs fall back to the default with a warning.",
    "",
    "- `data-material` (behaviour; breakable terrain looks like any slab in the game, so pick colours that tell materials apart):",
    ...catalog.material.map((m) => materialLine(ctx, m)),
    `- \`data-color\` (looks; any colour on any material, names only, no hex) — use the hex as that shape's \`fill\`: ${colours.join(", ")}.`,
    `- \`data-effect\`: ${codeList(catalog.effect.map((e) => e.id))}.`,
    `- \`data-sound\`: ${codeList(catalog.sound.map((s) => s.id))}.`,
    `- \`data-items\` (drop): ${codeList(itemIds(catalog, "drop"))}; default ${codeList(CATALOG_DEFAULTS.items.drop)}. List several to alternate crates.`,
    `- \`data-item\` (collectible): ${codeList(itemIds(catalog, "collectible"))}; default ${code(CATALOG_DEFAULTS.items.collectible)}.`,
    `- \`data-behavior\`: ${behaviors.length > 0 ? codeList(behaviors) : "none yet — leave it out"}.`,
  ].join("\n");
}

/** Jump, dive and wall metrics at `data-gravity="1"`, derived from the tunables. */
function movementLines({ tunables: t, cell }: PromptContext): string[] {
  const g = t.world.gravity;
  const { player: p, dive } = t;
  const apex = (p.jumpSpeed * p.jumpSpeed) / (2 * g);
  const runReach = p.runSpeed * ((2 * p.jumpSpeed) / g);
  const wallGain = (p.wallJumpSpeedY * p.wallJumpSpeedY) / (2 * g);
  const diveDistance = dive.launchSpeed * dive.travelSeconds;
  return [
    `- Player collider \`${p.width} × ${p.height}\`; comfortable corridor height \`${snapDown(p.height * 3, cell)}\`+.`,
    `- Gravity \`${g}\` units/s², max fall speed \`${t.world.maxFallSpeed}\`. Run speed \`${p.runSpeed}\` units/s.`,
    `- Jump: \`jumpSpeed ${p.jumpSpeed}\` → apex ~\`${round(apex)}\` units in ${(p.jumpSpeed / g).toFixed(2)} s. Easy step up \`${snapDown(apex * 0.5, cell)}\`, hard step \`${snapDown(apex * 0.85, cell)}\`. Running jump across a flat gap: ~\`${snapDown(runReach * 0.75, cell)}\` comfortable, ~\`${round(runReach)}\` max.`,
    `- Headbutt dive (once per air time, aimed in 16 directions): \`${dive.launchSpeed}\` units/s for \`${dive.travelSeconds}\` s (~\`${round(diveDistance)}\` units) after a \`${dive.windupSeconds}\` s windup; jump + dive gap ~\`${snapDown(runReach * 0.75 + diveDistance * 0.6, cell)}\`–\`${snapDown(runReach + diveDistance * 0.6, cell)}\`. A head-on dive into a wall bonks (\`${dive.bonkStunSeconds}\` s stun).`,
    `- Wall slide \`${p.wallSlideSpeed}\` units/s; wall jump \`vx ${p.wallJumpSpeedX}\`, \`vy ${p.wallJumpSpeedY}\` (~\`${round(wallGain)}\` height per kick). Wall-jump chimney width \`${snapDown(p.width * 4.5, cell)}\`–\`${snapDown(p.width * 8, cell)}\`.`,
  ];
}

/** Weapon blast metrics: reach, push, crater, recoil, rocket-jump height. */
function weaponLines({ tunables: t }: PromptContext): string[] {
  const g = t.world.gravity;
  const weapons = [
    { name: "rocket-launcher", w: t.combat.rocket },
    { name: "homing-launcher", w: t.combat.homing },
  ];
  const lines = weapons.map(({ name, w }) => {
    const push = blastPushAt(t, w.power, 0);
    return `- ${code(name)}: ${w.ammo} shots, blast power \`${w.power}\` → reach \`${round(blastReach(t, w.power))}\`, push \`${round(push)}\` units/s at the centre, crater \`${round(craterReach(t, w.power))}\` at toughness 1 (crater = this ÷ toughness), recoil \`${w.recoil}\`.`;
  });
  const rocket = t.combat.rocket;
  const blastOnly = blastPushAt(t, rocket.power, 0);
  const withRecoil = blastOnly + rocket.recoil;
  return [
    ...lines,
    `- Rocket jump (no self-damage): a point-blank blast under a standing player lifts ~\`${round((blastOnly * blastOnly) / (2 * g))}\` units, ~\`${round((withRecoil * withRecoil) / (2 * g))}\` with the shot's recoil.`,
    `- Homing missiles fly \`${t.combat.homing.speed}\` units/s and turn slowly: open spaces make them dodgeable, tight corridors make them deadly.`,
  ];
}

function renderPhysics(ctx: PromptContext): string {
  const m = ctx.tunables.match;
  return [
    '## 5. Player physics & jump metrics (at `data-gravity="1"`)',
    "",
    "With another gravity multiplier `k`, heights and jump gaps scale by about `1 / k`.",
    "",
    ...movementLines(ctx),
    ...weaponLines(ctx),
    `- Match: up to ${m.maxPlayers} players, ${m.durationSeconds} s by default; respawn after ${m.respawnDelaySeconds} s at a spawn.`,
  ].join("\n");
}

function renderChecklist(ctx: PromptContext): string {
  const v = LEVEL_FORMAT_VERSION;
  return [
    "## 6. Pre-output validation checklist",
    "",
    `1. One root \`<svg id="level" data-level-format="${v}" viewBox="0 0 W H" data-title="…">\`, viewBox starting at \`0 0\`.`,
    '2. Exactly one `<rect data-role="bounds">`, inside the viewBox, a bit larger than the terrain.',
    "3. At least one `terrain` shape; every terrain shape's `data-material` and `data-color` are IDs from § 4 (or left out).",
    `4. ≥ ${RECOMMENDED_SPAWNS} \`spawn\` circles inside bounds, not inside terrain, centre ~\`${spawnLift(ctx.tunables)}\` above a surface.`,
    "5. ≥ 1 `drop` circle inside bounds, high up, with `data-items` from § 4.",
    "6. `collectible` circles (optional) inside bounds with a `data-item` from § 4.",
    `7. Only rect / polygon / circle carry \`data-role\`; no \`<path>\`, no \`transform\`, no units; terrain snapped to multiples of \`${ctx.cell}\`.`,
    "8. Every shape has a `fill`; every route in the map request is reachable with the metrics in § 5.",
    "9. Each `<g data-motion>` holds only terrain and follows the moving-part rules in § 3.",
  ].join("\n");
}

/** A tiny level that passes every check: the shape of a valid answer. */
function renderMinimalLevel({ catalog, tunables }: PromptContext): string {
  const surface = 560;
  const spawnY = surface - spawnLift(tunables);
  const fill = materialFill(catalog, CATALOG_DEFAULTS.material);
  const spawns = [320, 520, 680, 880].map(
    (x) =>
      `      <circle data-role="spawn" cx="${x}" cy="${spawnY}" r="${POINT_RADIUS.spawn}" fill="${PREVIEW_FILLS.spawn}" />`
  );
  const drops = itemIds(catalog, "drop").join(" ");
  return [
    "```html",
    "<!doctype html>",
    '<html lang="en">',
    '  <head><meta charset="utf-8" /><title>Tiny Box — Bompers level</title></head>',
    "  <body>",
    `    <svg id="level" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" data-level-format="${LEVEL_FORMAT_VERSION}" data-title="Tiny Box">`,
    `      <rect data-role="bounds" x="0" y="0" width="1200" height="800" fill="none" stroke="${PREVIEW_FILLS.bounds}" />`,
    `      <rect data-role="terrain" data-material="${CATALOG_DEFAULTS.material}" x="240" y="${surface}" width="720" height="64" fill="${fill}" />`,
    ...spawns,
    `      <circle data-role="drop" data-items="${drops}" cx="600" cy="80" r="${POINT_RADIUS.drop}" fill="${PREVIEW_FILLS.drop}" />`,
    "    </svg>",
    "  </body>",
    "</html>",
    "```",
  ].join("\n");
}

function renderMapRequest(): string {
  return [
    "## 7. Map request",
    "",
    "Describe your map here: a name, the size, the theme and flow, where the platforms, breakable parts, spawns, drops and pickups go, and anything special you want.",
  ].join("\n");
}

/** The full prompt, from the given tunables (default: the game's) and the live catalog. */
export function buildLevelPrompt(tunables: GameTunables = DEFAULT_GAME_TUNABLES): string {
  const ctx: PromptContext = {
    catalog: exportCatalog(),
    tunables,
    cell: CATALOG_DEFAULTS.cellSize,
  };
  const sections = [
    renderIntro(),
    renderFileContract(ctx),
    renderCoordinates(ctx),
    renderRoles(ctx),
    renderMovingParts(ctx),
    renderCatalog(ctx),
    renderPhysics(ctx),
    renderChecklist(ctx),
    `Smallest valid level (shape reference only; build the map from § 7):\n\n${renderMinimalLevel(ctx)}`,
    renderMapRequest(),
  ];
  return `${sections.join("\n\n")}\n`;
}
