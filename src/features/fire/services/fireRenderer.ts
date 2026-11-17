import { Container, Graphics } from "pixi.js";
import { GAME_PALETTE } from "@/shared/config/gamePalette";
import type { Vec2 } from "@/shared/types/gameGeometry.types";
import { outlineWidth } from "@/shared/utils/outlineWidth";
import { EMPTY_CELL, type TerrainGrid } from "@/features/arena/api/arenaApi";
import { helmetPoint } from "@/features/combat/api/combatApi";
import type { PlayerState } from "@/features/player/api/playerApi";
import { burningSamples } from "@/features/fire/services/fireSim";
import { drawBlobFire } from "@/features/fire/services/blobFireRenderer";
import {
  FLAME_LOOK,
  clusterFlames,
  pilotTongue,
  releasePuff,
  sprayFlame,
  tonguePoints,
  type Circle,
  type FlameBlock,
  type Slab,
  type SprayFlame,
  type Tongue,
} from "@/features/fire/services/flameShapes";
import type { FireState } from "@/features/fire/types/fire.types";

/**
 * Fire layers in the "Sticker flames" look (owner fire-visuals D1–D3, DESIGN_LANGUAGE § 1
 * Effects): every flame is drawn in ink first and in colour on top, so a fire of any size has
 * one ink line around it (line style E) and stays apart from cardboard and orange blobs.
 * - Over the terrain: scorch on earth (redrawn only when the fire changes); the burning samples
 *   as one fire shape per cluster (fire-clusters D1–D2): a body slab per row run of 2 × 2
 *   blocks and flames on its top edge only, so a big fire costs a few dozen shapes; a smoke
 *   puff where a batch burns out.
 * - Above the players: each torch spray as a neck and a rolling head (`flameShapes`), the head's
 *   puff when a spray stops, the idle flame on a held torch, then the burning blobs
 *   (`blobFireRenderer`, fire-burn b2).
 * All render only: nothing here feeds back into the sim.
 */
export interface FireView {
  /** Scorch, flames and smoke: add right above the terrain. */
  terrainLayer: Container;
  /** Torch sprays: add above the players. */
  sprayLayer: Container;
  scorch: Graphics;
  flames: Graphics;
  smoke: Graphics;
  sprays: Graphics;
  /** Burning blobs' flames and sweat, and their moments (above the players). */
  blobs: Graphics;
  /** Fire `version` the scorch was drawn at. */
  scorchVersion: number;
  /** Per torch slot: when its spray started and where its head last was (grow-in, release puff). */
  torches: Map<number, TorchMemo>;
  puffs: SmokePuff[];
  /** Samples waiting to burn out last frame: their count and a few of them (smoke positions). */
  dueCount: number;
  dueSample: number[];
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
  /** Players in play (burning-blob flames, idle torch flames), sim time and moment length. */
  players: readonly PlayerState[];
  timeSeconds: number;
  momentSeconds: number;
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
const INK = GAME_PALETTE.ink;
const MAX_PUFFS = 24;
/** A spray missing for longer than this has stopped (its next start grows in again). */
const SPRAY_GAP_SECONDS = 0.1;

export function createFireView(): FireView {
  const scorch = new Graphics({ label: "fire-scorch" });
  const flames = new Graphics({ label: "fire-flames" });
  const smoke = new Graphics({ label: "fire-smoke" });
  const sprays = new Graphics({ label: "torch-sprays" });
  const blobs = new Graphics({ label: "burning-blobs" });
  const terrainLayer = new Container({ label: "fire" });
  terrainLayer.addChild(scorch, flames, smoke);
  const sprayLayer = new Container({ label: "torch" });
  sprayLayer.addChild(sprays, blobs);
  return {
    terrainLayer,
    sprayLayer,
    scorch,
    flames,
    smoke,
    sprays,
    blobs,
    scorchVersion: -1,
    torches: new Map(),
    puffs: [],
    dueCount: 0,
    dueSample: [],
  };
}

const isSolid = (grid: TerrainGrid, index: number): boolean =>
  (grid.cells[index] ?? EMPTY_CELL) !== EMPTY_CELL;

const sampleCentre = (grid: TerrainGrid, index: number): Vec2 => ({
  x: ((index % grid.widthCells) + 0.5) * grid.cellSize,
  y: (Math.floor(index / grid.widthCells) + 0.5) * grid.cellSize,
});

function drawScorch(view: FireView, frame: FireFrame): void {
  const { fire, terrain } = frame;
  view.scorch.clear();
  fire.scorched.forEach((mark, index) => {
    if (mark !== 1 || !isSolid(terrain, index)) return;
    const at = sampleCentre(terrain, index);
    view.scorch.circle(at.x, at.y, terrain.cellSize * 0.75);
  });
  view.scorch.fill({ color: COLORS.scorch, alpha: 0.4 });
  view.scorchVersion = fire.version;
}

/** The 2 × 2 blocks of burning samples, by `by * widthCells + bx`. */
function flameBlocks(frame: FireFrame): Map<number, FlameBlock> {
  const { terrain, fire } = frame;
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
      y: (by + 0.5) * size,
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

/** Adds each slab to the pending shapes as a rounded rect, grown by `grow` for the ink pass. */
function slabs(g: Graphics, list: readonly Slab[], look: { radius: number; grow?: number }): void {
  const grow = look.grow ?? 0;
  for (const slab of list) {
    g.roundRect(
      slab.x - grow,
      slab.y - grow,
      slab.w + 2 * grow,
      slab.h + 2 * grow,
      look.radius + grow
    );
  }
}

/**
 * The terrain fire as one shape per cluster (owner fire-clusters D1–D2): body slabs and the
 * top-edge flames in ink, then in ember, then the hot inside and the flames' hearts in amber.
 */
function drawFlames(view: FireView, frame: FireFrame, ink: number): void {
  const g = view.flames.clear();
  const blocks = flameBlocks(frame);
  if (blocks.size === 0) return;
  const size = frame.terrain.cellSize * 2;
  const { body, hot, flames } = clusterFlames(blocks, {
    size,
    stride: frame.terrain.widthCells,
    timeSeconds: frame.nowMs / 1000,
    burnSeconds: frame.burnSeconds,
  });
  const radius = FLAME_LOOK.cluster.bodyRadius * size;
  for (const [grow, color] of [
    [ink, INK],
    [0, COLORS.outer],
  ] as const) {
    slabs(g, body, { radius, grow });
    tongues(g, flames, grow);
    g.fill(color);
  }
  slabs(g, hot, { radius: FLAME_LOOK.cluster.hotRadius * size });
  const ambers = flames.map((tongue) => heart(tongue, 0.6));
  if (tongues(g, ambers) || hot.length > 0) g.fill(COLORS.mid);
  const cores = flames.filter((flame) => flame.age < 0.4).map((tongue) => heart(tongue, 0.3));
  if (tongues(g, cores)) g.fill(COLORS.core);
}

/** Remembers a few of the samples about to burn out; when the batch goes, they puff smoke. */
function trackBurnOuts(view: FireView, frame: FireFrame): void {
  const due = frame.fire.dueOut;
  if (due.length < view.dueCount) {
    for (const index of view.dueSample) {
      if (view.puffs.length >= MAX_PUFFS) break;
      view.puffs.push({ ...sampleCentre(frame.terrain, index), bornAt: frame.timeSeconds });
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
    const aim = Math.hypot(player.aimX, player.aimY) || 1;
    const from = helmetPoint(player);
    const nozzle = {
      x: from.x + (player.aimX / aim) * nozzleReach,
      y: from.y + (player.aimY / aim) * nozzleReach,
    };
    const flame = pilotTongue(nozzle, { timeSeconds: frame.nowMs / 1000, seed: player.slot });
    g.poly(tonguePoints(flame, look.ink)).fill(INK);
    g.poly(tonguePoints(flame)).fill(COLORS.outer);
    g.poly(tonguePoints(heart(flame, 0.58))).fill(COLORS.mid);
    g.circle(nozzle.x, nozzle.y + 0.3, 0.8).fill(COLORS.core);
  }
}

export function syncFireView(view: FireView, frame: FireFrame): void {
  if (view.scorchVersion !== frame.fire.version) drawScorch(view, frame);
  const ink = outlineWidth("effect", frame.zoom).width;
  drawFlames(view, frame, ink);
  trackBurnOuts(view, frame);
  drawSmoke(view, frame);
  view.sprays.clear();
  const on = drawSprays(view, frame, ink);
  drawReleases(view, frame, { ink, on });
  drawPilots(view, frame, { ink, on });
  drawBlobFire(view.blobs.clear(), frame);
}
