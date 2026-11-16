import { Container, Graphics } from "pixi.js";
import { GAME_PALETTE, terrainSwatch } from "@/shared/config/gamePalette";
import { outlineWidth } from "@/shared/utils/outlineWidth";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import type { TerrainGrid } from "@/features/arena/types/arena.types";
import { isBreakableSlot, takeDirtyChunks } from "@/features/arena/services/terrainGrid";
import { pieceCellSlot } from "@/features/arena/services/terrainRaster";
import { readTile, tileCellsFor, type TileState } from "@/features/arena/services/terrainTiles";
import {
  drawBreakableMasks,
  drawSlabFill,
  drawSlabInk,
  type SlabPiece,
} from "@/features/arena/services/terrainSurfaces";

/**
 * Terrain layer (DESIGN_LANGUAGE § 2–3, § 5 step 3). Every material draws as the same rounded
 * slab with a top lip in its piece's colour swatch (material-system D3); behaviour shows through
 * the surface pattern, never the colour. Back to front:
 * - **Ink:** style E silhouette — every slab stroked at twice the outline width, fills on top, so
 *   one outer line shows. Unbreakable slabs' ink is drawn as is; breakable slabs' ink is clipped
 *   by a mask of their standing cells grown by the outline width. Redrawn when the zoom-clamped
 *   width changes step.
 * - **Fills:** unbreakable slabs (with ice gloss) drawn once; breakable slabs clipped by a mask of
 *   their standing cells (rebuilt when the sim marks chunks dirty), so a crater cuts the slab.
 * - **Seams:** one `Graphics` per grid chunk over breakable cells: seam lines between intact tiles,
 *   a centre pip per intact tile, cracks next to a crater. Redrawn only when dirty (plus
 *   neighbours) and cached as a texture.
 */
export interface TerrainView {
  container: Container;
  solidInk: Graphics;
  solidFill: Graphics;
  breakableInk: Graphics;
  breakableFill: Graphics;
  masks: { cells: Graphics; ink: Graphics };
  chunks: Graphics[];
  solids: readonly SlabPiece[];
  breakables: readonly SlabPiece[];
  /** Cells at level load: a cell that was filled and is empty now is a crater (cracks). */
  initial: Uint8Array;
  tileCells: number;
  /** Outline step the ink pass was drawn at (null before the first draw). */
  inkStep: number | null;
  /** Ink width the ink mask was grown by. */
  inkWidth: number;
}

/** Tile look relative to the tile edge (mockup: 26-unit cell, 1.8 pip). */
const TILE = { pip: 1.8 / 26, line: 0.9, crack: 1.1, pipAlpha: 0.5 };

function slabPieces(level: LevelDefinition): { solids: SlabPiece[]; breakables: SlabPiece[] } {
  const solids: SlabPiece[] = [];
  const breakables: SlabPiece[] = [];
  for (const piece of level.terrain) {
    const slot = pieceCellSlot(piece);
    const slab = { shape: piece.shape, swatch: terrainSwatch(slot.colorId), surface: slot.surface };
    (isBreakableSlot(slot) ? breakables : solids).push(slab);
  }
  return { solids, breakables };
}

/** The layer graphics in draw order; breakable ink and fills are clipped by the cell masks. */
function createLayers(grid: TerrainGrid) {
  const container = new Container({ label: "terrain" });
  const solidInk = new Graphics({ label: "solid-ink" });
  const solidFill = new Graphics({ label: "solid-fill" });
  const breakableInk = new Graphics({ label: "breakable-ink" });
  const breakableFill = new Graphics({ label: "breakable-fill" });
  const masks = {
    cells: new Graphics({ label: "breakable-cell-mask" }),
    ink: new Graphics({ label: "breakable-ink-mask" }),
  };
  breakableFill.mask = masks.cells;
  breakableInk.mask = masks.ink;
  const seams = new Container({ label: "breakable-seams" });
  const chunks = Array.from({ length: grid.chunksX * grid.chunksY }, () => new Graphics());
  seams.addChild(...chunks);
  container.addChild(solidInk, breakableInk, solidFill, breakableFill, seams);
  container.addChild(masks.cells, masks.ink);
  return { container, solidInk, solidFill, breakableInk, breakableFill, masks, chunks };
}

export function createTerrainView(arena: {
  terrain: TerrainGrid;
  level: LevelDefinition;
}): TerrainView {
  const grid = arena.terrain;
  const layers = createLayers(grid);
  const { solids, breakables } = slabPieces(arena.level);
  drawSlabFill(layers.solidFill, solids);
  drawSlabFill(layers.breakableFill, breakables);
  return {
    ...layers,
    solids,
    breakables,
    initial: grid.cells.slice(),
    tileCells: tileCellsFor(grid.cellSize),
    inkStep: null,
    inkWidth: 0,
  };
}

interface TileDraw {
  x: number;
  y: number;
  size: number;
  cellSize: number;
  k: number;
  seam: number;
  /** The tiles right of and below are intact breakable tiles too (seam lines go between). */
  right: boolean;
  below: boolean;
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

/** Seams between intact tiles and a centre pip; cracks on intact tiles next to a crater. */
function drawTile(g: Graphics, tile: TileState, at: TileDraw): void {
  if (!tile.intact) return;
  const { x, y, size, seam } = at;
  if (at.right) g.moveTo(x + size, y).lineTo(x + size, y + size);
  if (at.below) g.moveTo(x, y + size).lineTo(x + size, y + size);
  if (at.right || at.below) g.stroke({ width: TILE.line, color: seam });
  g.circle(x + size / 2, y + size / 2, size * TILE.pip).fill({ color: seam, alpha: TILE.pipAlpha });
  // Cracks mark the intact tiles around a crater; the crater edge itself shows stepped cells.
  if (tile.cracked) drawCrack(g, at);
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
      const intactAt = (dx: number, dy: number): boolean =>
        readTile(grid, view.initial, { tx: tx + dx, ty: ty + dy, k }).intact;
      drawTile(graphics, tile, {
        x: tx * size,
        y: ty * size,
        size,
        cellSize: grid.cellSize,
        k,
        seam: terrainSwatch(slotInfo.colorId).seam,
        right: tile.intact && intactAt(1, 0),
        below: tile.intact && intactAt(0, 1),
      });
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

/** Redraws what changed: dirty chunks and the breakable masks, and the ink on an outline step. */
export function syncTerrainView(view: TerrainView, grid: TerrainGrid, zoom: number): void {
  const outline = outlineWidth("terrain", zoom);
  const stepChanged = outline.step !== view.inkStep;
  if (stepChanged) {
    drawSlabInk(view.solidInk, view.solids, outline.width);
    drawSlabInk(view.breakableInk, view.breakables, outline.width);
    view.inkStep = outline.step;
    view.inkWidth = outline.width;
  }
  const redraw = chunksToRedraw(grid);
  if (stepChanged || redraw.size > 0) {
    const any = drawBreakableMasks(grid, view.masks, view.inkWidth);
    view.breakableFill.visible = any;
    view.breakableInk.visible = any;
  }
  for (const index of redraw) drawChunk(view, grid, index);
}
