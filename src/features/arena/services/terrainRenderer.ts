import { Container, Graphics } from "pixi.js";
import { GAME_PALETTE } from "@/shared/config/gamePalette";
import { DESIGN_SCALE, outlineWidth } from "@/shared/utils/outlineWidth";
import type { LevelDefinition, TerrainShape } from "@/features/level/api/levelApi";
import type { TerrainGrid } from "@/features/arena/types/arena.types";
import { takeDirtyChunks } from "@/features/arena/services/terrainGrid";
import { pieceCellSlot } from "@/features/arena/services/terrainRaster";
import { readTile, tileCellsFor, type TileState } from "@/features/arena/services/terrainTiles";

/**
 * Terrain layer (DESIGN_LANGUAGE § 2–3, § 5 step 3), back to front:
 * - **Solid slabs** (indestructible pieces): drawn once from the level's shapes (visual-pass D2) as
 *   rounded plum slabs with a lighter top lip. Style E silhouette: an ink pass of every slab
 *   stroked at twice the outline width, then the fills on top, so only one outer line shows. The
 *   ink pass redraws when the zoom-clamped width changes step.
 * - **Destructible tiles** (honey): one `Graphics` per grid chunk, redrawn only when the sim marks
 *   the chunk dirty (plus its neighbours, whose tiles share the crater edge). Intact tiles are
 *   rounded squares with a grid line and a centre pip; partly blasted tiles show their remaining
 *   cells stepped; tiles next to a crater crack. No ink outline on cells.
 */
export interface TerrainView {
  container: Container;
  solidInk: Graphics;
  solidFill: Graphics;
  chunks: Graphics[];
  solids: readonly SolidPiece[];
  /** Cells at level load: a cell that was filled and is empty now is a crater (cracks). */
  initial: Uint8Array;
  tileCells: number;
  /** Outline step the ink pass was drawn at (null before the first draw). */
  inkStep: number | null;
}

interface SolidPiece {
  shape: TerrainShape;
  fill: number;
  lip: number;
}

/** Mockup numbers at the reference blob, scaled to the game (visual-pass D1). */
const SLAB = { radius: 14 * DESIGN_SCALE, lipInset: 6 * DESIGN_SCALE, lipTop: 4 * DESIGN_SCALE };
const LIP_HEIGHT = 9 * DESIGN_SCALE;
/** Tile look relative to the tile edge (mockup: 26-unit cell, 5 corner, 1.8 pip). */
const TILE = { corner: 5 / 26, pip: 1.8 / 26, line: 0.9, crack: 1.1, pipAlpha: 0.5 };

const lookOf = (lookToken: string) =>
  GAME_PALETTE.materialLooks[lookToken] ?? GAME_PALETTE.fallbackLook;

function solidPieces(level: LevelDefinition): SolidPiece[] {
  return level.terrain.flatMap((piece) => {
    const slot = pieceCellSlot(piece);
    if (slot.destructible) return [];
    const look = lookOf(slot.lookToken);
    return [{ shape: piece.shape, fill: look.fill, lip: look.accent }];
  });
}

function slabPath(g: Graphics, shape: TerrainShape): Graphics {
  if (shape.type === "rect") {
    const radius = Math.min(SLAB.radius, shape.w / 2, shape.h / 2);
    return g.roundRect(shape.x, shape.y, shape.w, shape.h, radius);
  }
  if (shape.type === "circle") return g.circle(shape.cx, shape.cy, shape.r);
  return g.poly(shape.points.flatMap((p) => [p.x, p.y]));
}

function drawSolidInk(g: Graphics, solids: readonly SolidPiece[], width: number): void {
  g.clear();
  for (const { shape } of solids) {
    // Stroke only: the fills cover the inside, so an ink fill would be pure overdraw.
    slabPath(g, shape).stroke({ width: width * 2, color: GAME_PALETTE.ink, join: "round" });
  }
}

/** Fills, then the lip along the top of rect slabs tall enough to carry one. */
function drawSolidFill(g: Graphics, solids: readonly SolidPiece[]): void {
  for (const { shape, fill } of solids) slabPath(g, shape).fill(fill);
  for (const { shape, lip } of solids) {
    if (shape.type !== "rect" || shape.h < LIP_HEIGHT * 2) continue;
    g.roundRect(
      shape.x + SLAB.lipInset,
      shape.y + SLAB.lipTop,
      shape.w - SLAB.lipInset * 2,
      LIP_HEIGHT,
      LIP_HEIGHT / 2
    ).fill(lip);
  }
}

export function createTerrainView(arena: {
  terrain: TerrainGrid;
  level: LevelDefinition;
}): TerrainView {
  const grid = arena.terrain;
  const container = new Container({ label: "terrain" });
  const solidInk = new Graphics({ label: "solid-ink" });
  const solidFill = new Graphics({ label: "solid-fill" });
  const cells = new Container({ label: "destructible-cells" });
  const chunks = Array.from({ length: grid.chunksX * grid.chunksY }, () => new Graphics());
  cells.addChild(...chunks);
  container.addChild(solidInk, solidFill, cells);
  const solids = solidPieces(arena.level);
  drawSolidFill(solidFill, solids);
  return {
    container,
    solidInk,
    solidFill,
    chunks,
    solids,
    initial: grid.cells.slice(),
    tileCells: tileCellsFor(grid.cellSize),
    inkStep: null,
  };
}

interface TileDraw {
  x: number;
  y: number;
  size: number;
  cellSize: number;
  k: number;
  color: number;
}

/** Zig-zag crack across the tile centre (mockup path, scaled to the tile). */
function drawCrack(g: Graphics, { x, y, size }: TileDraw): void {
  const u = size / 26;
  const cx = x + size / 2;
  const cy = y + size / 2;
  g.moveTo(cx - 9 * u, cy - 4 * u)
    .lineTo(cx - 2 * u, cy)
    .lineTo(cx + 2 * u, cy - 7 * u)
    .lineTo(cx + 9 * u, cy - 2 * u)
    .stroke({
      width: TILE.crack,
      color: GAME_PALETTE.crack,
      alpha: 0.8,
      cap: "round",
      join: "round",
    });
}

function drawTile(g: Graphics, tile: TileState, at: TileDraw): void {
  const { x, y, size, cellSize, k, color } = at;
  if (tile.intact) {
    g.roundRect(x, y, size, size, size * TILE.corner)
      .fill(color)
      .stroke({ width: TILE.line, color: GAME_PALETTE.cellLine });
    g.circle(x + size / 2, y + size / 2, size * TILE.pip).fill({
      color: GAME_PALETTE.cellLine,
      alpha: TILE.pipAlpha,
    });
  } else {
    tile.filled.forEach((on, i) => {
      if (on) g.rect(x + (i % k) * cellSize, y + Math.floor(i / k) * cellSize, cellSize, cellSize);
    });
    g.fill(color);
  }
  // Cracks mark the intact tiles around a crater; the crater edge itself shows stepped cells.
  if (tile.cracked && tile.intact) drawCrack(g, at);
}

/** Tile range whose origin cell lies in the chunk (each tile is drawn by exactly one chunk). */
function chunkTiles(grid: TerrainGrid, chunkIndex: number, k: number) {
  const cx0 = (chunkIndex % grid.chunksX) * grid.chunkCells;
  const cy0 = Math.floor(chunkIndex / grid.chunksX) * grid.chunkCells;
  return {
    tx0: Math.ceil(cx0 / k),
    ty0: Math.ceil(cy0 / k),
    cx1: Math.min(cx0 + grid.chunkCells, grid.widthCells),
    cy1: Math.min(cy0 + grid.chunkCells, grid.heightCells),
  };
}

/**
 * A drawn chunk holds hundreds of small rounded tiles; caching it as one texture turns that into
 * one quad per frame. Resolution 2 keeps it crisp at the camera's closest zoom (≈ 1.8).
 */
const CHUNK_CACHE = { resolution: 2, antialias: true };

/** Draws a chunk's tiles; caches it as a texture when it has any (empty chunks draw nothing). */
function drawChunk(view: TerrainView, grid: TerrainGrid, chunkIndex: number): void {
  const graphics = view.chunks[chunkIndex];
  if (!graphics) return;
  graphics.clear();
  const tiles = drawChunkTiles(view, grid, { graphics, chunkIndex });
  if (tiles === 0) {
    graphics.cacheAsTexture(false);
    return;
  }
  if (graphics.isCachedAsTexture) graphics.updateCacheTexture();
  else graphics.cacheAsTexture(CHUNK_CACHE);
}

/** Draws the tiles whose origin is in the chunk; returns how many were drawn. */
function drawChunkTiles(
  view: TerrainView,
  grid: TerrainGrid,
  { graphics, chunkIndex }: { graphics: Graphics; chunkIndex: number }
): number {
  let drawn = 0;
  const k = view.tileCells;
  const { tx0, ty0, cx1, cy1 } = chunkTiles(grid, chunkIndex, k);
  const size = k * grid.cellSize;
  for (let ty = ty0; ty * k < cy1; ty += 1) {
    for (let tx = tx0; tx * k < cx1; tx += 1) {
      const tile = readTile(grid, view.initial, { tx, ty, k });
      const slotInfo = grid.slots[tile.slot];
      if (!slotInfo || tile.filled.every((on) => !on)) continue;
      const look = lookOf(slotInfo.lookToken);
      const color = (tx + ty) % 3 === 0 ? look.accent : look.fill;
      const at = { x: tx * size, y: ty * size, size, cellSize: grid.cellSize, k, color };
      drawTile(graphics, tile, at);
      drawn += 1;
    }
  }
  return drawn;
}

/** Dirty chunks plus their eight neighbours (tiles and cracks read across chunk edges). */
function chunksToRedraw(grid: TerrainGrid): Set<number> {
  const redraw = new Set<number>();
  for (const index of takeDirtyChunks(grid)) {
    const cx = index % grid.chunksX;
    const cy = Math.floor(index / grid.chunksX);
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && y >= 0 && x < grid.chunksX && y < grid.chunksY) {
          redraw.add(y * grid.chunksX + x);
        }
      }
    }
  }
  return redraw;
}

/** Redraws what changed: dirty chunks, and the slab ink when the outline step changed. */
export function syncTerrainView(view: TerrainView, grid: TerrainGrid, zoom: number): void {
  const outline = outlineWidth("terrain", zoom);
  if (outline.step !== view.inkStep) {
    drawSolidInk(view.solidInk, view.solids, outline.width);
    view.inkStep = outline.step;
  }
  for (const index of chunksToRedraw(grid)) drawChunk(view, grid, index);
}
