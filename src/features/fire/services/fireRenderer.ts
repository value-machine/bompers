import { Container, Graphics } from "pixi.js";
import { GAME_PALETTE } from "@/shared/config/gamePalette";
import type { Vec2 } from "@/shared/types/gameGeometry.types";
import { inkColor } from "@/shared/utils/debugInk";
import { outlineWidth } from "@/shared/utils/outlineWidth";
import {
  EMPTY_CELL,
  bodyGrids,
  bodyWorldPoint,
  createPoseLayer,
  drawContour,
  edgeAbove,
  markedRegion,
  placePoseLayer,
  terrainContour,
  type MoverBody,
  type TerrainGrid,
} from "@/features/arena/api/arenaApi";
import { helmetPoint } from "@/features/combat/api/combatApi";
import { weaponAim, type PlayerState } from "@/features/player/api/playerApi";
import { burningSamples } from "@/features/fire/services/fireSim";
import {
  FLAME_LOOK,
  clusterFlames,
  pilotTongue,
  releasePuff,
  sprayFlame,
  tonguePoints,
  type Circle,
  type FlameBlock,
  type SprayFlame,
  type Tongue,
} from "@/features/fire/services/flameShapes";
import type { FireState, GroundFire } from "@/features/fire/types/fire.types";

/**
 * Fire layers in the "Sticker flames" look (owner fire-visuals D1–D3, DESIGN_LANGUAGE § 1
 * Effects): every flame is drawn in ink first and in colour on top, so a fire of any size has
 * one ink line around it (line style E) and stays apart from cardboard and orange blobs.
 * - Over the terrain: scorch on earth (redrawn only when the fire changes); the burning terrain
 *   as one fire shape (fire-clusters D1–D2, element-overlay-shape D1): its body is the terrain's
 *   own contour limited to the burning samples, so it has the terrain's curves and a curved
 *   edge inside it (redrawn when the fire or the terrain changes, not per frame), with flames
 *   on its top edge only, rooted on the terrain's edge; a smoke puff where a batch burns out.
 * - Above the players: each torch spray as a neck and a rolling head (`flameShapes`), the head's
 *   puff when a spray stops and the idle flame on a held torch (burning blobs are drawn by the
 *   blob-fire feature, on its own layer above this one).
 * Every body of the arena has its own set of terrain layers (mover-materials-l2 D3, D4): the
 * static terrain's in world coordinates, a moving part's in the part's own frame, following its
 * pose, so a part's fire rides and turns with it. Smoke is in world coordinates for all.
 * All render only: nothing here feeds back into the sim.
 */
export interface FireView {
  /** Scorch, flames and smoke: add right above the terrain. */
  terrainLayer: Container;
  /** Torch sprays: add above the players. */
  sprayLayer: Container;
  /** One set of terrain layers per body, in the arena's body order; made when first drawn. */
  grounds: GroundFireView[];
  smoke: Graphics;
  sprays: Graphics;
  /** Per torch slot: when its spray started and where its head last was (grow-in, release puff). */
  torches: Map<number, TorchMemo>;
  puffs: SmokePuff[];
}

/** The fire layers of one body: scorch, the burning body and its flames. */
interface GroundFireView {
  /** Holds the layers; a moving part's is turned about its pivot and shifted by its pose. */
  layer: Container;
  scorch: Graphics;
  /** The burning terrain: ink, then (above the flames' ink) ember and the hot inside. */
  bodyInk: Graphics;
  bodyFill: Graphics;
  bodyHot: Graphics;
  /** What the body was drawn from; it is redrawn when this changes. */
  bodyKey: string;
  flameInk: Graphics;
  flames: Graphics;
  /** Fire `version` the scorch was drawn at. */
  scorchVersion: number;
  /** Samples waiting to burn out last frame: their count and a few of them (smoke positions). */
  dueCount: number;
  dueSample: number[];
}

/** What one body's fire is drawn from: its view, its ground fire and its own grid. */
interface GroundDraw {
  view: GroundFireView;
  fire: GroundFire;
  terrain: TerrainGrid;
  frame: FireFrame;
}

interface TorchMemo {
  startedAt: number;
  lastSeenAt: number;
  head: Vec2;
  radius: number;
}

interface SmokePuff {
  x: number;
  y: number;
  bornAt: number;
}

export interface FireFrame {
  fire: FireState;
  terrain: TerrainGrid;
  /** Render clock, ms (flicker only). */
  nowMs: number;
  /** Players in play (idle torch flames) and sim time. */
  players: readonly PlayerState[];
  timeSeconds: number;
  /** Camera zoom this frame (outline width clamp). */
  zoom: number;
  /** Ids of the players holding a torch (idle flame on the nozzle). */
  torchHolderIds: ReadonlySet<string>;
  /** The torch's full reach: a ray that ended short of it met terrain. */
  torchLength: number;
  /** How long a lit sample burns (`fire.burnSeconds`): flames shrink over it. */
  burnSeconds: number;
}

const COLORS = GAME_PALETTE.fire;
/** Ink of the torch sprays, release puffs, pilot flames and smoke edges. */
const INK = inkColor("fireSprays");
const BODY_INK = inkColor("fireBody");
const FLAME_INK = inkColor("fireFlames");
const SCORCH = inkColor("fireScorch", COLORS.scorch);
const MAX_PUFFS = 24;
/** A spray missing for longer than this has stopped (its next start grows in again). */
const SPRAY_GAP_SECONDS = 0.1;

/** One body's layers; a moving part's sit in its rest pose inside a layer that follows its pose. */
function createGroundView(mover: MoverBody | undefined): GroundFireView {
  const scorch = new Graphics({ label: "fire-scorch" });
  const bodyInk = new Graphics({ label: "fire-body-ink" });
  const flameInk = new Graphics({ label: "fire-flame-ink" });
  const bodyFill = new Graphics({ label: "fire-body" });
  const bodyHot = new Graphics({ label: "fire-body-hot" });
  const flames = new Graphics({ label: "fire-flames" });
  const layer = mover
    ? createPoseLayer(mover, "fire-on-part")
    : new Container({ label: "fire-on-terrain" });
  // Both inks under both fills: the body and its flames share one outline.
  const parts = [scorch, bodyInk, flameInk, bodyFill, bodyHot, flames];
  // A part's field starts at its origin in the rest pose.
  if (mover) for (const g of parts) g.position.set(mover.origin.x, mover.origin.y);
  layer.addChild(...parts);
  return {
    layer,
    scorch,
    bodyInk,
    bodyFill,
    bodyHot,
    bodyKey: "",
    flameInk,
    flames,
    scorchVersion: -1,
    dueCount: 0,
    dueSample: [],
  };
}

export function createFireView(): FireView {
  const smoke = new Graphics({ label: "fire-smoke" });
  const sprays = new Graphics({ label: "torch-sprays" });
  const terrainLayer = new Container({ label: "fire" });
  terrainLayer.addChild(smoke);
  const sprayLayer = new Container({ label: "torch" });
  sprayLayer.addChild(sprays);
  return {
    terrainLayer,
    sprayLayer,
    grounds: [],
    smoke,
    sprays,
    torches: new Map(),
    puffs: [],
  };
}

/** The view of body `body`, made (under the smoke) the first time that body is drawn. */
function groundView(view: FireView, terrain: TerrainGrid, body: number): GroundFireView {
  const known = view.grounds[body];
  if (known) return known;
  const made = createGroundView(terrain.movers[body - 1]);
  view.grounds[body] = made;
  view.terrainLayer.addChildAt(made.layer, view.terrainLayer.getChildIndex(view.smoke));
  return made;
}

const isSolid = (grid: TerrainGrid, index: number): boolean =>
  (grid.cells[index] ?? EMPTY_CELL) !== EMPTY_CELL;

const sampleCentre = (grid: TerrainGrid, index: number): Vec2 => ({
  x: ((index % grid.widthCells) + 0.5) * grid.cellSize,
  y: (Math.floor(index / grid.widthCells) + 0.5) * grid.cellSize,
});

function drawScorch({ view, fire, terrain }: GroundDraw): void {
  view.scorch.clear();
  fire.scorched.forEach((mark, index) => {
    if (mark !== 1 || !isSolid(terrain, index)) return;
    const at = sampleCentre(terrain, index);
    view.scorch.circle(at.x, at.y, terrain.cellSize * 0.75);
  });
  view.scorch.fill({ color: SCORCH, alpha: 0.4 });
  view.scorchVersion = fire.version;
}

/**
 * Where a block's flame is rooted: a little under the terrain's edge in the block's column, so
 * flames stand on a slope or a crater rim; the block's middle when terrain covers it.
 */
function flameRootY(terrain: TerrainGrid, block: { cx: number; by: number }): number {
  const size = terrain.cellSize * 2;
  for (const cy of [block.by * 2, block.by * 2 + 1]) {
    const edge = edgeAbove(terrain, cy * terrain.widthCells + block.cx);
    if (edge !== null) return edge + FLAME_LOOK.cluster.flameRoot * size;
  }
  return (block.by + 0.5) * size;
}

/** The 2 × 2 blocks of burning samples, by `by * widthCells + bx`. */
function flameBlocks({ terrain, fire, frame }: GroundDraw): Map<number, FlameBlock> {
  const size = terrain.cellSize * 2;
  const blocks = new Map<number, FlameBlock>();
  for (const index of burningSamples(fire)) {
    if (!isSolid(terrain, index)) continue;
    const cx = index % terrain.widthCells;
    const bx = Math.floor(cx / 2);
    const by = Math.floor(Math.floor(index / terrain.widthCells) / 2);
    const key = by * terrain.widthCells + bx;
    if (blocks.has(key)) continue;
    const above = (by * 2 - 1) * terrain.widthCells + cx;
    blocks.set(key, {
      bx,
      by,
      x: (bx + 0.5) * size,
      y: flameRootY(terrain, { cx, by }),
      age: Math.max(0, frame.timeSeconds - (fire.igniteAt[index] ?? frame.timeSeconds)),
      open: by === 0 || !isSolid(terrain, above),
      key,
    });
  }
  return blocks;
}

/** A tongue shrunk toward its base: the amber and pale hearts inside the ember flame. */
const heart = (tongue: Tongue, k: number): Tongue => ({
  x: tongue.x,
  y: tongue.y + 0.4,
  width: tongue.width * k,
  height: tongue.height * k,
  sway: tongue.sway * k,
});

/** Adds each tongue to the pending shapes; returns whether there was any. */
function tongues(g: Graphics, list: readonly Tongue[], grow = 0): boolean {
  for (const tongue of list) g.poly(tonguePoints(tongue, grow));
  return list.length > 0;
}

function circles(g: Graphics, list: readonly Circle[], look: { grow?: number; scale?: number }) {
  for (const c of list) g.circle(c.x, c.y, c.r * (look.scale ?? 1) + (look.grow ?? 0));
  return list.length > 0;
}

/** Seconds between redraws of the hot inside while a fire burns (it fades as samples age). */
const HOT_STEP_SECONDS = 0.25;

/**
 * The burning terrain's body (element-overlay-shape D1): the terrain's contour limited to the
 * burning samples, in ink grown by the outline width, in ember, and the fresh samples' inside in
 * amber. Redrawn only when the fire, the terrain or the outline width changes, and a few times a
 * second for the hot inside.
 */
function drawBody(draw: GroundDraw, ink: number): void {
  const { view, fire, terrain, frame } = draw;
  const hotStep = Math.floor(frame.timeSeconds / HOT_STEP_SECONDS);
  const key = `${fire.version}:${terrain.shapeVersion}:${ink}:${hotStep}`;
  if (key === view.bodyKey) return;
  view.bodyKey = key;
  const burning = burningSamples(fire);
  const region = markedRegion(terrain, burning);
  if (!region) {
    for (const g of [view.bodyInk, view.bodyFill, view.bodyHot]) g.clear();
    return;
  }
  drawContour(view.bodyInk, terrainContour(terrain, { grow: ink, region }), BODY_INK);
  drawContour(view.bodyFill, terrainContour(terrain, { grow: 0, region }), COLORS.outer);
  drawHot(draw, burning);
}

/** The amber inside of the samples that caught not long ago, in from the body's edge. */
function drawHot({ view, fire, terrain, frame }: GroundDraw, burning: readonly number[]): void {
  const { hotUntil, hotInset } = FLAME_LOOK.cluster;
  const freshFor = hotUntil * frame.burnSeconds;
  const region = markedRegion(
    terrain,
    burning.filter((index) => frame.timeSeconds - (fire.igniteAt[index] ?? 0) < freshFor)
  );
  if (!region) {
    view.bodyHot.clear();
    return;
  }
  const grow = -hotInset * terrain.cellSize * 2;
  drawContour(view.bodyHot, terrainContour(terrain, { grow, region }), COLORS.mid);
}

/**
 * The flames on the fire's top edge (owner fire-clusters D1–D2): in ink under the body's fill,
 * then in ember with their amber and pale hearts on top of it.
 */
function drawFlames(draw: GroundDraw, ink: number): void {
  const { view, terrain, frame } = draw;
  const g = view.flames.clear();
  view.flameInk.clear();
  const blocks = flameBlocks(draw);
  if (blocks.size === 0) return;
  const flames = clusterFlames(blocks, {
    size: terrain.cellSize * 2,
    stride: terrain.widthCells,
    timeSeconds: frame.nowMs / 1000,
    burnSeconds: frame.burnSeconds,
  });
  if (tongues(view.flameInk, flames, ink)) view.flameInk.fill(FLAME_INK);
  if (tongues(g, flames)) g.fill(COLORS.outer);
  const ambers = flames.map((tongue) => heart(tongue, 0.6));
  if (tongues(g, ambers)) g.fill(COLORS.mid);
  const cores = flames.filter((flame) => flame.age < 0.4).map((tongue) => heart(tongue, 0.3));
  if (tongues(g, cores)) g.fill(COLORS.core);
}

/** Remembers a few of the samples about to burn out; when the batch goes, they puff smoke. */
function trackBurnOuts(puffs: SmokePuff[], draw: GroundDraw, body: number): void {
  const { view, fire, terrain, frame } = draw;
  const due = fire.dueOut;
  if (due.length < view.dueCount) {
    for (const index of view.dueSample) {
      if (puffs.length >= MAX_PUFFS) break;
      // Smoke is in world coordinates: a part's puff starts where the part was and rises.
      const at = bodyWorldPoint(frame.terrain, body, sampleCentre(terrain, index));
      puffs.push({ ...at, bornAt: frame.timeSeconds });
    }
  }
  view.dueCount = due.length;
  const picks = [0, 1 / 3, 2 / 3, 1].map((k) => due[Math.floor(k * (due.length - 1))]);
  view.dueSample = [...new Set(picks.filter((index): index is number => index !== undefined))];
}

/** White puffs with a soft ink edge (DESIGN_LANGUAGE § 1 smoke), rising as they fade. */
function drawSmoke(view: FireView, frame: FireFrame): void {
  const g = view.smoke.clear();
  view.puffs = view.puffs.filter((puff) => {
    const k = (frame.timeSeconds - puff.bornAt) / FLAME_LOOK.smokeSeconds;
    return k >= 0 && k < 1;
  });
  for (const puff of view.puffs) {
    const k = (frame.timeSeconds - puff.bornAt) / FLAME_LOOK.smokeSeconds;
    g.circle(puff.x, puff.y - 14 * k, 2.2 + 3.3 * k)
      .fill({ color: GAME_PALETTE.smoke, alpha: 0.62 * (1 - 0.5 * k) })
      .stroke({ width: 0.8, color: INK, alpha: 0.3 * (1 - k) });
  }
}

/** A spray's silhouette in ink: every outer shape grown by the outline width. */
function drawSprayInk(g: Graphics, flame: SprayFlame, ink: number): void {
  g.poly(flame.layers[0].neck)
    .fill(INK)
    .stroke({ width: ink * 2, color: INK, join: "round" });
  circles(g, flame.layers[0].lobes, { grow: ink });
  circles(g, flame.splashes, { grow: ink });
  tongues(g, flame.shed, ink);
  g.fill(INK);
}

/** One spray: everything in ink, then ember, amber and the pale core on top. */
function drawSprayFlame(g: Graphics, flame: SprayFlame, ink: number): void {
  const [outer, mid, core] = flame.layers;
  drawSprayInk(g, flame, ink);
  g.poly(outer.neck);
  circles(g, outer.lobes, {});
  circles(g, flame.splashes, {});
  tongues(g, flame.shed);
  g.fill(COLORS.outer);
  g.poly(mid.neck);
  circles(g, mid.lobes, {});
  circles(g, flame.splashes, { scale: 0.6 });
  tongues(
    g,
    flame.shed.filter((tongue) => tongue.fade < 0.6).map((tongue) => heart(tongue, 0.55))
  );
  g.fill(COLORS.mid);
  g.poly(core.neck).fill(COLORS.core);
}

/** Draws the live sprays and remembers each one's start and head. Returns the spraying slots. */
function drawSprays(view: FireView, frame: FireFrame, ink: number): Set<number> {
  const { growSeconds } = FLAME_LOOK.spray;
  const spraying = new Set<number>();
  for (const spray of frame.fire.sprays) {
    spraying.add(spray.slot);
    const known = view.torches.get(spray.slot);
    const fresh = !known || frame.timeSeconds - known.lastSeenAt > SPRAY_GAP_SECONDS;
    const startedAt = fresh ? frame.timeSeconds : known.startedAt;
    const flame = sprayFlame(spray, {
      timeSeconds: frame.nowMs / 1000,
      // Starts a fifth grown, so the first frame already shows a flame.
      grow: 0.2 + (0.8 * (frame.timeSeconds - startedAt)) / growSeconds,
      reach: frame.torchLength,
    });
    view.torches.set(spray.slot, {
      startedAt,
      lastSeenAt: frame.timeSeconds,
      head: flame.head,
      radius: flame.headRadius,
    });
    drawSprayFlame(view.sprays, flame, ink);
  }
  return spraying;
}

/** A spray that just stopped: its head lets go as one puff that rises and shrinks. */
function drawReleases(view: FireView, frame: FireFrame, look: { ink: number; on: Set<number> }) {
  const g = view.sprays;
  for (const [slot, memo] of view.torches) {
    if (look.on.has(slot)) continue;
    const k = (frame.timeSeconds - memo.lastSeenAt) / FLAME_LOOK.spray.releaseSeconds;
    if (k < 0 || k >= 1) {
      view.torches.delete(slot);
      continue;
    }
    const puff = releasePuff(memo, k);
    if (circles(g, puff, { grow: look.ink })) g.fill(INK);
    if (circles(g, puff, {})) g.fill(COLORS.outer);
    if (circles(g, puff.slice(0, 1), { scale: 0.55 })) g.fill(COLORS.mid);
  }
}

/** The idle flame on the nozzle of every held torch that is not spraying. */
function drawPilots(view: FireView, frame: FireFrame, look: { ink: number; on: Set<number> }) {
  const g = view.sprays;
  const { nozzleReach } = FLAME_LOOK.spray;
  for (const player of frame.players) {
    if (!frame.torchHolderIds.has(player.id) || look.on.has(player.slot)) continue;
    const aim = weaponAim(player);
    const from = helmetPoint(player);
    const nozzle = { x: from.x + aim.x * nozzleReach, y: from.y + aim.y * nozzleReach };
    const flame = pilotTongue(nozzle, { timeSeconds: frame.nowMs / 1000, seed: player.slot });
    g.poly(tonguePoints(flame, look.ink)).fill(INK);
    g.poly(tonguePoints(flame)).fill(COLORS.outer);
    g.poly(tonguePoints(heart(flame, 0.58))).fill(COLORS.mid);
    g.circle(nozzle.x, nozzle.y + 0.3, 0.8).fill(COLORS.core);
  }
}

export function syncFireView(view: FireView, frame: FireFrame): void {
  const ink = outlineWidth("effect", frame.zoom).width;
  bodyGrids(frame.terrain).forEach((terrain, body) => {
    const fire = frame.fire.grounds[body];
    if (!fire) return;
    const draw = { view: groundView(view, frame.terrain, body), fire, terrain, frame };
    const mover = frame.terrain.movers[body - 1];
    if (mover) placePoseLayer(draw.view.layer, mover);
    if (draw.view.scorchVersion !== fire.version) drawScorch(draw);
    drawBody(draw, ink);
    drawFlames(draw, ink);
    trackBurnOuts(view.puffs, draw, body);
  });
  drawSmoke(view, frame);
  view.sprays.clear();
  const on = drawSprays(view, frame, ink);
  drawReleases(view, frame, { ink, on });
  drawPilots(view, frame, { ink, on });
}
