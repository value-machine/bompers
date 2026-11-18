import { Container, Graphics } from "pixi.js";
import { GAME_PALETTE } from "@/shared/config/gamePalette";
import type { Vec2 } from "@/shared/types/gameGeometry.types";
import type { GridBlock } from "@/shared/utils/blockSlabs";
import { outlineWidth } from "@/shared/utils/outlineWidth";
import { EMPTY_CELL, type TerrainGrid } from "@/features/arena/api/arenaApi";
import {
  ICE_LOOK,
  breathRelease,
  breathShape,
  frozenShapes,
  type BreathShape,
  type Disc,
} from "@/features/ice/services/iceShapes";
import type { IceState } from "@/features/ice/types/ice.types";

/**
 * Ice layers (owner, ice-element D4, D9; DESIGN_LANGUAGE § 1 Effects, § 2 slippery cue).
 * - Over the terrain: frozen ground in the ice colours, as body slabs with a lighter lip on top
 *   edges and a few gloss streaks. It sits inside the terrain's own ink line, so it needs none.
 *   Redrawn only when the terrain's frozen flags change.
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
  frost: Graphics;
  beams: Graphics;
  /** Terrain `frozenVersion` the frost was drawn at. */
  frostVersion: number;
  /** Per ray slot: when its breath started and where its head last was (grow-in, release puff). */
  breaths: Map<number, BreathMemo>;
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
  /** Render clock, ms (the breath's roll and specks only). */
  nowMs: number;
  /** Sim time, seconds (when a breath started and stopped). */
  timeSeconds: number;
  /** Camera zoom this frame (outline width clamp). */
  zoom: number;
}

const COLORS = GAME_PALETTE.ice;
const INK = GAME_PALETTE.ink;
/** A breath missing for longer than this has stopped (its next start grows in again). */
const BREATH_GAP_SECONDS = 0.1;

export function createIceView(): IceView {
  const frost = new Graphics({ label: "ice-frost" });
  const beams = new Graphics({ label: "freeze-rays" });
  const terrainLayer = new Container({ label: "ice" });
  terrainLayer.addChild(frost);
  const beamLayer = new Container({ label: "freeze-ray" });
  beamLayer.addChild(beams);
  return { terrainLayer, beamLayer, frost, beams, frostVersion: -1, breaths: new Map() };
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

function drawFrost(view: IceView, terrain: TerrainGrid): void {
  const g = view.frost.clear();
  view.frostVersion = terrain.frozenVersion;
  const blocks = frozenBlocks(terrain);
  if (blocks.size === 0) return;
  const size = terrain.cellSize * 2;
  const { body, lip, gloss } = frozenShapes(blocks, { size, stride: terrain.widthCells });
  const radius = ICE_LOOK.bodyRadius * size;
  for (const slab of body) g.roundRect(slab.x, slab.y, slab.w, slab.h, radius);
  g.fill(COLORS.body);
  for (const slab of lip) g.roundRect(slab.x, slab.y, slab.w, slab.h, radius);
  if (lip.length > 0) g.fill(COLORS.lip);
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
  if (view.frostVersion !== frame.terrain.frozenVersion) drawFrost(view, frame.terrain);
  const ink = outlineWidth("effect", frame.zoom).width;
  view.beams.clear();
  const on = drawBreaths(view, frame, ink);
  drawReleases(view, frame, { ink, on });
}
