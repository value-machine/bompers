import { Container, Graphics } from "pixi.js";
import { GAME_PALETTE } from "@/shared/config/gamePalette";
import type { GridBlock } from "@/shared/utils/blockSlabs";
import { outlineWidth } from "@/shared/utils/outlineWidth";
import { EMPTY_CELL, type TerrainGrid } from "@/features/arena/api/arenaApi";
import { ICE_LOOK, beamShape, frozenShapes } from "@/features/ice/services/iceShapes";
import type { IceState } from "@/features/ice/types/ice.types";

/**
 * Ice layers (owner, ice-element D4; DESIGN_LANGUAGE § 1 Effects, § 2 slippery cue).
 * - Over the terrain: frozen ground in the ice colours, as body slabs with a lighter lip on top
 *   edges and a few gloss streaks. It sits inside the terrain's own ink line, so it needs none.
 *   Redrawn only when the terrain's frozen flags change.
 * - Above the players: each freeze ray as a beam, ink first and colour on top, with a frost
 *   burst where it touches terrain.
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
}

export interface IceFrame {
  ice: IceState;
  terrain: TerrainGrid;
  /** Render clock, ms (the burst's pulse only). */
  nowMs: number;
  /** Camera zoom this frame (outline width clamp). */
  zoom: number;
}

const COLORS = GAME_PALETTE.ice;
const INK = GAME_PALETTE.ink;

export function createIceView(): IceView {
  const frost = new Graphics({ label: "ice-frost" });
  const beams = new Graphics({ label: "freeze-rays" });
  const terrainLayer = new Container({ label: "ice" });
  terrainLayer.addChild(frost);
  const beamLayer = new Container({ label: "freeze-ray" });
  beamLayer.addChild(beams);
  return { terrainLayer, beamLayer, frost, beams, frostVersion: -1 };
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
  if (gloss.length > 0)
    g.stroke({ width: size * 0.22, color: COLORS.gloss, alpha: 0.6, cap: "round" });
}

function drawBeams(view: IceView, frame: IceFrame): void {
  const g = view.beams.clear();
  const ink = outlineWidth("effect", frame.zoom).width;
  for (const beam of frame.ice.rays) {
    const shape = beamShape(beam, frame.nowMs / 1000);
    g.poly(shape.outline)
      .fill(INK)
      .stroke({ width: ink * 2, color: INK, join: "round" });
    for (const burst of shape.bursts) g.circle(burst.x, burst.y, burst.r + ink);
    if (shape.bursts.length > 0) g.fill(INK);
    g.poly(shape.outline).fill(COLORS.beam);
    for (const burst of shape.bursts) g.circle(burst.x, burst.y, burst.r);
    if (shape.bursts.length > 0) g.fill(COLORS.beam);
    g.poly(shape.core).fill(COLORS.beamCore);
    for (const burst of shape.bursts) g.circle(burst.x, burst.y, burst.r * 0.5);
    if (shape.bursts.length > 0) g.fill(COLORS.beamCore);
  }
}

export function syncIceView(view: IceView, frame: IceFrame): void {
  if (view.frostVersion !== frame.terrain.frozenVersion) drawFrost(view, frame.terrain);
  drawBeams(view, frame);
}
