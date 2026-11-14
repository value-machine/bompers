import { Container, Graphics } from "pixi.js";
import { GAME_PALETTE } from "@/shared/config/gamePalette";
import { TERRAIN_CELL, type TerrainGrid } from "@/features/arena/types/arena.types";
import { getCell, takeDirtyChunks } from "@/features/arena/services/terrainGrid";

/**
 * Chunked terrain drawing: one `Graphics` per chunk, redrawn only when the simulation marked the
 * chunk dirty (blasts), so an explosion costs one chunk redraw, not the whole map.
 */
export interface TerrainView {
  container: Container;
  chunks: Graphics[];
}

const COLOR_BY_CELL: Record<number, number> = {
  [TERRAIN_CELL.solid]: GAME_PALETTE.terrainSolid,
  [TERRAIN_CELL.destructible]: GAME_PALETTE.terrainDestructible,
};

export function createTerrainView(grid: TerrainGrid): TerrainView {
  const container = new Container({ label: "terrain" });
  const chunks = Array.from({ length: grid.chunksX * grid.chunksY }, () => new Graphics());
  chunks.forEach((chunk) => container.addChild(chunk));
  return { container, chunks };
}

/** Draws one row of a chunk, merging runs of equal cells into one rect. */
function drawRow(
  graphics: Graphics,
  grid: TerrainGrid,
  row: { cy: number; x0: number; x1: number }
) {
  const size = grid.cellSize;
  let cx = row.x0;
  while (cx < row.x1) {
    const kind = getCell(grid, cx, row.cy);
    const runStart = cx;
    while (cx < row.x1 && getCell(grid, cx, row.cy) === kind) cx += 1;
    const color = COLOR_BY_CELL[kind];
    if (color !== undefined) {
      graphics.rect(runStart * size, row.cy * size, (cx - runStart) * size, size).fill(color);
    }
  }
}

function drawChunk(graphics: Graphics, grid: TerrainGrid, chunkIndex: number): void {
  const x0 = (chunkIndex % grid.chunksX) * grid.chunkCells;
  const y0 = Math.floor(chunkIndex / grid.chunksX) * grid.chunkCells;
  const x1 = Math.min(x0 + grid.chunkCells, grid.widthCells);
  const y1 = Math.min(y0 + grid.chunkCells, grid.heightCells);
  graphics.clear();
  for (let cy = y0; cy < y1; cy += 1) drawRow(graphics, grid, { cy, x0, x1 });
}

/** Redraws the chunks changed since the last call. Call once per rendered frame. */
export function syncTerrainView(view: TerrainView, grid: TerrainGrid): void {
  for (const index of takeDirtyChunks(grid)) {
    const graphics = view.chunks[index];
    if (graphics) drawChunk(graphics, grid, index);
  }
}
