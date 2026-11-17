import { Container, Graphics } from "pixi.js";
import { GAME_PALETTE } from "@/shared/config/gamePalette";
import { EMPTY_CELL, type TerrainGrid } from "@/features/arena/api/arenaApi";
import type { PlayerState } from "@/features/player/api/playerApi";
import { burningSamples } from "@/features/fire/services/fireSim";
import { drawBlobFire } from "@/features/fire/services/blobFireRenderer";
import type { FireState, TorchSpray } from "@/features/fire/types/fire.types";

/**
 * Fire layers (fire-spread b1, DESIGN_LANGUAGE § 1 Effects): over the terrain, scorch marks on
 * earth fire stopped at (redrawn only when the fire changes) and flames on burning terrain, one
 * flickering flame per 2 × 2 samples so a big fire stays cheap; above the players, each torch
 * spray as a flame fan from the helmet to where its rays ended, then the burning blobs
 * (`blobFireRenderer`, fire-burn b2).
 */
export interface FireView {
  /** Scorch and flames: add right above the terrain. */
  terrainLayer: Container;
  /** Torch sprays: add above the players. */
  sprayLayer: Container;
  scorch: Graphics;
  flames: Graphics;
  sprays: Graphics;
  /** Burning blobs' flames and sweat, and their moments (above the players). */
  blobs: Graphics;
  /** Fire `version` the scorch was drawn at. */
  scorchVersion: number;
}

export interface FireFrame {
  fire: FireState;
  terrain: TerrainGrid;
  /** Render clock, ms (flicker only). */
  nowMs: number;
  /** Players in play (burning-blob flames), sim time and moment length (fire-burn b2). */
  players: readonly PlayerState[];
  timeSeconds: number;
  momentSeconds: number;
}

const COLORS = GAME_PALETTE.fire;
/** Flame flicker: rate (rad / ms) and how much the size swings. */
const FLICKER = { rate: 0.012, depth: 0.25 };

export function createFireView(): FireView {
  const scorch = new Graphics({ label: "fire-scorch" });
  const flames = new Graphics({ label: "fire-flames" });
  const sprays = new Graphics({ label: "torch-sprays" });
  const blobs = new Graphics({ label: "burning-blobs" });
  const terrainLayer = new Container({ label: "fire" });
  terrainLayer.addChild(scorch, flames);
  const sprayLayer = new Container({ label: "torch" });
  sprayLayer.addChild(sprays, blobs);
  return { terrainLayer, sprayLayer, scorch, flames, sprays, blobs, scorchVersion: -1 };
}

const isSolid = (grid: TerrainGrid, index: number): boolean =>
  (grid.cells[index] ?? EMPTY_CELL) !== EMPTY_CELL;

function drawScorch(view: FireView, frame: FireFrame): void {
  const { fire, terrain } = frame;
  view.scorch.clear();
  const size = terrain.cellSize;
  fire.scorched.forEach((mark, index) => {
    if (mark !== 1 || !isSolid(terrain, index)) return;
    const cx = index % terrain.widthCells;
    const cy = Math.floor(index / terrain.widthCells);
    view.scorch.circle((cx + 0.5) * size, (cy + 0.5) * size, size * 0.75);
  });
  view.scorch.fill({ color: COLORS.scorch, alpha: 0.4 });
  view.scorchVersion = fire.version;
}

/** One flame per 2 × 2 block of burning samples: block key → its centre. */
function flameBlocks(frame: FireFrame): Map<number, { x: number; y: number }> {
  const { terrain } = frame;
  const blocks = new Map<number, { x: number; y: number }>();
  for (const index of burningSamples(frame.fire)) {
    if (!isSolid(terrain, index)) continue;
    const bx = Math.floor((index % terrain.widthCells) / 2);
    const by = Math.floor(Math.floor(index / terrain.widthCells) / 2);
    const key = by * terrain.widthCells + bx;
    if (!blocks.has(key)) {
      const size = terrain.cellSize * 2;
      blocks.set(key, { x: (bx + 0.5) * size, y: (by + 0.5) * size });
    }
  }
  return blocks;
}

function drawFlames(view: FireView, frame: FireFrame): void {
  const g = view.flames.clear();
  const size = frame.terrain.cellSize * 2;
  const blocks = flameBlocks(frame);
  const flick = (key: number) =>
    1 - FLICKER.depth + FLICKER.depth * Math.sin(frame.nowMs * FLICKER.rate + key * 1.7);
  for (const [key, at] of blocks) {
    const f = flick(key);
    g.ellipse(at.x, at.y - size * 0.35 * f, size * 0.55 * f, size * 0.85 * f);
  }
  g.fill({ color: COLORS.outer, alpha: 0.9 });
  for (const [key, at] of blocks) {
    const f = flick(key);
    g.ellipse(at.x, at.y - size * 0.2 * f, size * 0.3 * f, size * 0.5 * f);
  }
  g.fill({ color: COLORS.mid });
}

/** A flame fan from the helmet: outer over the full rays, core over the near 55 %. */
function drawSpray(g: Graphics, spray: TorchSpray, flicker: number): void {
  const fan = (reach: number): number[] => [
    spray.origin.x,
    spray.origin.y,
    ...spray.ends.flatMap((end) => [
      spray.origin.x + (end.x - spray.origin.x) * reach,
      spray.origin.y + (end.y - spray.origin.y) * reach,
    ]),
  ];
  g.poly(fan(flicker)).fill({ color: COLORS.outer, alpha: 0.6 });
  g.poly(fan(0.55 * flicker)).fill({ color: COLORS.mid, alpha: 0.85 });
  g.poly(fan(0.25 * flicker)).fill({ color: COLORS.core, alpha: 0.9 });
}

export function syncFireView(view: FireView, frame: FireFrame): void {
  if (view.scorchVersion !== frame.fire.version) drawScorch(view, frame);
  drawFlames(view, frame);
  const g = view.sprays.clear();
  for (const spray of frame.fire.sprays) {
    const flicker = 0.9 + 0.1 * Math.sin(frame.nowMs * 0.03 + spray.slot);
    drawSpray(g, spray, flicker);
  }
  drawBlobFire(view.blobs.clear(), frame);
}
