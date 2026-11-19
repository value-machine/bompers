import { Container, Graphics } from "pixi.js";
import { GAME_PALETTE } from "@/shared/config/gamePalette";
import type { Vec2 } from "@/shared/types/gameGeometry.types";
import { inkColor } from "@/shared/utils/debugInk";
import { outlineWidth } from "@/shared/utils/outlineWidth";
import {
  EMPTY_CELL,
  belowLipRegion,
  bodyGrids,
  createPoseLayer,
  drawContour,
  markedRegion,
  placePoseLayer,
  terrainContour,
  type MoverBody,
  type TerrainGrid,
} from "@/features/arena/api/arenaApi";
import {
  ICE_LOOK,
  breathRelease,
  breathShape,
  frostGloss,
  type BreathShape,
  type Disc,
  type GridBlock,
} from "@/features/ice/services/iceShapes";
import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { PlayerState } from "@/features/player/api/playerApi";
import { drawBlobIce } from "@/features/ice/services/blobIceRenderer";
import type { IceState } from "@/features/ice/types/ice.types";

/**
 * Ice layers (owner, ice-element D4, D9; DESIGN_LANGUAGE § 1 Effects, § 2 slippery cue).
 * - Over the terrain: frozen ground in the ice colours, in the terrain's own shape
 *   (element-overlay-shape D1): the terrain's contour limited to the frozen samples, lighter
 *   along its top (the lip) and with a few gloss streaks. It sits inside the terrain's own ink
 *   line, so it needs none. Redrawn only when the frozen flags or the terrain change. Every
 *   body of the arena has its own frost layers (mover-materials lap 2b): a moving part's are
 *   drawn in the part's frame and follow its pose, so the ice rides and turns with the part.
 * - Above the players: each freeze ray as a cold breath ("Cold breath", owner D9), ink first and
 *   colour on top: a thin neck, a rolling head where it lands, snow specks; the head lets go as a
 *   few rising puffs when the ray stops.
 * All render only: nothing here feeds back into the sim.
 */
export interface IceView {
  /** Frozen ground: add right above the terrain. */
  terrainLayer: Container;
  /** Freeze rays: add above the players. */
  beamLayer: Container;
  /** One set of frost layers per body, in the arena's body order; made when first drawn. */
  grounds: FrostView[];
  /** Ice blocks around frozen blobs and their moments, under the rays. */
  blocks: Graphics;
  beams: Graphics;
  /** Per ray slot: when its breath started and where its head last was (grow-in, release puff). */
  breaths: Map<number, BreathMemo>;
}

/** The frozen ground of one body. */
interface FrostView {
  /** Holds the layers; a moving part's follows its pose (the arena's pose layer). */
  layer: Container;
  /** The whole shape in the lip colour, its body one sample lower, gloss on top. */
  frostLip: Graphics;
  frostBody: Graphics;
  frost: Graphics;
  /** The body's `frozenVersion` and `shapeVersion` the frost was drawn at. */
  frostVersion: number;
  frostShapeVersion: number;
}

interface BreathMemo {
  startedAt: number;
  lastSeenAt: number;
  head: Vec2;
  radius: number;
}

export interface IceFrame {
  ice: IceState;
  terrain: TerrainGrid;
  /** Players in play (the ice blocks are drawn over them). */
  players: readonly PlayerState[];
  /** `ice.blob` tunables (how full the chill is, how long a moment shows). */
  blob: GameTunables["ice"]["blob"];
  /** Render clock, ms (the breath's roll and specks only). */
  nowMs: number;
  /** Sim time, seconds (when a breath started and stopped). */
  timeSeconds: number;
  /** Camera zoom this frame (outline width clamp). */
  zoom: number;
}

const COLORS = GAME_PALETTE.ice;
const INK = inkColor("ice");
/** A breath missing for longer than this has stopped (its next start grows in again). */
const BREATH_GAP_SECONDS = 0.1;

/** One body's frost layers; a moving part's sit in its rest pose inside a pose layer. */
function createFrostView(mover: MoverBody | undefined): FrostView {
  const frostLip = new Graphics({ label: "ice-frost-lip" });
  const frostBody = new Graphics({ label: "ice-frost-body" });
  const frost = new Graphics({ label: "ice-frost-gloss" });
  const layer = mover
    ? createPoseLayer(mover, "ice-on-part")
    : new Container({ label: "ice-on-terrain" });
  const parts = [frostLip, frostBody, frost];
  // A part's field starts at its origin in the rest pose.
  if (mover) for (const g of parts) g.position.set(mover.origin.x, mover.origin.y);
  layer.addChild(...parts);
  return { layer, frostLip, frostBody, frost, frostVersion: -1, frostShapeVersion: -1 };
}

export function createIceView(): IceView {
  const beams = new Graphics({ label: "freeze-rays" });
  const terrainLayer = new Container({ label: "ice" });
  const beamLayer = new Container({ label: "freeze-ray" });
  const blocks = new Graphics({ label: "ice-blocks" });
  beamLayer.addChild(blocks, beams);
  return { terrainLayer, beamLayer, blocks, grounds: [], beams, breaths: new Map() };
}

/** The frost view of body `body`, made the first time that body is drawn. */
function frostView(view: IceView, terrain: TerrainGrid, body: number): FrostView {
  const known = view.grounds[body];
  if (known) return known;
  const made = createFrostView(terrain.movers[body - 1]);
  view.grounds[body] = made;
  view.terrainLayer.addChild(made.layer);
  return made;
}

/** The 2 × 2 blocks that hold a frozen sample, by `by * widthCells + bx`. */
function frozenBlocks(terrain: TerrainGrid): Map<number, GridBlock> {
  const blocks = new Map<number, GridBlock>();
  terrain.frozen.forEach((flag, index) => {
    if (flag !== 1 || (terrain.cells[index] ?? EMPTY_CELL) === EMPTY_CELL) return;
    const bx = Math.floor((index % terrain.widthCells) / 2);
    const by = Math.floor(Math.floor(index / terrain.widthCells) / 2);
    const key = by * terrain.widthCells + bx;
    if (!blocks.has(key)) blocks.set(key, { bx, by });
  });
  return blocks;
}

function frozenSamples(terrain: TerrainGrid): number[] {
  const frozen: number[] = [];
  terrain.frozen.forEach((flag, index) => {
    if (flag === 1) frozen.push(index);
  });
  return frozen;
}

function drawFrost(view: FrostView, terrain: TerrainGrid): void {
  view.frost.clear();
  view.frostVersion = terrain.frozenVersion;
  view.frostShapeVersion = terrain.shapeVersion;
  const region = markedRegion(terrain, frozenSamples(terrain));
  if (!region) {
    view.frostLip.clear();
    view.frostBody.clear();
    return;
  }
  drawContour(view.frostLip, terrainContour(terrain, { grow: 0, region }), COLORS.lip);
  // The shape without its top sample row: drawn over the whole shape, it leaves the lip.
  const body = terrainContour(terrain, {
    grow: 0,
    region: belowLipRegion(terrain, region, "region"),
  });
  drawContour(view.frostBody, body, COLORS.body);
  drawGloss(view.frost, terrain);
}

function drawGloss(g: Graphics, terrain: TerrainGrid): void {
  const size = terrain.cellSize * 2;
  const gloss = frostGloss(frozenBlocks(terrain), { size, stride: terrain.widthCells });
  for (const { a, b } of gloss) g.moveTo(a.x, a.y).lineTo(b.x, b.y);
  if (gloss.length > 0) {
    g.stroke({ width: size * 0.22, color: COLORS.gloss, alpha: 0.6, cap: "round" });
  }
}

/** Adds each disc to the pending shapes; returns whether there was any. */
function discs(g: Graphics, list: readonly Disc[], look: { grow?: number; scale?: number }) {
  for (const d of list) g.circle(d.x, d.y, d.r * (look.scale ?? 1) + (look.grow ?? 0));
  return list.length > 0;
}

/** One breath: everything in ink, then the ice body, the lighter inside and the white specks. */
function drawBreath(g: Graphics, shape: BreathShape, ink: number): void {
  g.poly(shape.neck)
    .fill(INK)
    .stroke({ width: ink * 2, color: INK, join: "round" });
  discs(g, shape.lobes, { grow: ink });
  discs(g, shape.specks, { grow: ink * 0.6 });
  g.fill(INK);
  g.poly(shape.neck);
  discs(g, shape.lobes, {});
  g.fill(COLORS.body);
  g.poly(shape.neckInner);
  discs(g, shape.lobes, { scale: ICE_LOOK.breath.innerShare });
  g.fill(COLORS.lip);
  if (discs(g, shape.specks, {})) g.fill(COLORS.gloss);
}

/** Draws the live breaths and remembers each one's start and head. Returns the breathing slots. */
function drawBreaths(view: IceView, frame: IceFrame, ink: number): Set<number> {
  const on = new Set<number>();
  for (const beam of frame.ice.rays) {
    on.add(beam.slot);
    const known = view.breaths.get(beam.slot);
    const fresh = !known || frame.timeSeconds - known.lastSeenAt > BREATH_GAP_SECONDS;
    const startedAt = fresh ? frame.timeSeconds : known.startedAt;
    const shape = breathShape(beam, {
      timeSeconds: frame.nowMs / 1000,
      // Starts a fifth grown, so the first frame already shows a breath.
      grow: 0.2 + (0.8 * (frame.timeSeconds - startedAt)) / ICE_LOOK.breath.growSeconds,
    });
    view.breaths.set(beam.slot, {
      startedAt,
      lastSeenAt: frame.timeSeconds,
      head: shape.head,
      radius: shape.headRadius,
    });
    drawBreath(view.beams, shape, ink);
  }
  return on;
}

/** A breath that just stopped: its head lets go as a few puffs that rise and shrink. */
function drawReleases(view: IceView, frame: IceFrame, look: { ink: number; on: Set<number> }) {
  const g = view.beams;
  for (const [slot, memo] of view.breaths) {
    if (look.on.has(slot)) continue;
    const k = (frame.timeSeconds - memo.lastSeenAt) / ICE_LOOK.breath.releaseSeconds;
    if (k < 0 || k >= 1) {
      view.breaths.delete(slot);
      continue;
    }
    const puffs = breathRelease(memo, k);
    if (discs(g, puffs, { grow: look.ink })) g.fill(INK);
    if (discs(g, puffs, {})) g.fill(COLORS.body);
    if (discs(g, puffs, { scale: ICE_LOOK.breath.innerShare })) g.fill(COLORS.lip);
  }
}

export function syncIceView(view: IceView, frame: IceFrame): void {
  bodyGrids(frame.terrain).forEach((grid, body) => {
    const frost = frostView(view, frame.terrain, body);
    const mover = frame.terrain.movers[body - 1];
    if (mover) placePoseLayer(frost.layer, mover);
    const stale =
      frost.frostVersion !== grid.frozenVersion || frost.frostShapeVersion !== grid.shapeVersion;
    if (stale) drawFrost(frost, grid);
  });
  const ink = outlineWidth("effect", frame.zoom).width;
  view.blocks.clear();
  drawBlobIce(view.blocks, {
    ice: frame.ice,
    players: frame.players,
    timeSeconds: frame.timeSeconds,
    blob: frame.blob,
    ink,
  });
  view.beams.clear();
  const on = drawBreaths(view, frame, ink);
  drawReleases(view, frame, { ink, on });
}
