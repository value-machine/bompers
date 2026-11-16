import { EMPTY_CELL, type TerrainGrid } from "@/features/arena/types/arena.types";
import { getCellSlot, isBreakableSlot } from "@/features/arena/services/terrainGrid";

/**
 * Destructible cells are drawn as visual tiles of `tileCells × tileCells` sim cells
 * (DESIGN_LANGUAGE § 2 "square cells with a grid"; visual-pass D3). Pure reads of the grid so the
 * renderer only turns a tile's state into shapes.
 */
export const TILE_WORLD_SIZE = 16;

/** Sim cells per tile edge for a grid's cell size (at least 1). */
export const tileCellsFor = (cellSize: number): number =>
  Math.max(1, Math.round(TILE_WORLD_SIZE / cellSize));

export interface TileState {
  /** Destructible slot of the first filled cell, or EMPTY_CELL when none is filled. */
  slot: number;
  /** Row-major filled flags for the tile's cells (breakable cells only). */
  filled: boolean[];
  /** Every cell of the tile is a filled breakable cell. */
  intact: boolean;
  /** A cell of the tile or of its one-cell ring was filled at load and is empty now (D6). */
  cracked: boolean;
}

const isBreakable = (grid: TerrainGrid, slot: number): boolean =>
  slot !== EMPTY_CELL && isBreakableSlot(grid.slots[slot]);

/** True when the cell held a breakable cell at load and is empty now. */
function wasBlasted(
  grid: TerrainGrid,
  initial: Uint8Array,
  { cx, cy }: { cx: number; cy: number }
): boolean {
  if (cx < 0 || cy < 0 || cx >= grid.widthCells || cy >= grid.heightCells) return false;
  const before = initial[cy * grid.widthCells + cx] ?? EMPTY_CELL;
  return isBreakable(grid, before) && getCellSlot(grid, cx, cy) === EMPTY_CELL;
}

function hasBlastNear(grid: TerrainGrid, initial: Uint8Array, box: TileBox): boolean {
  const { cx0, cy0, k } = box;
  for (let cy = cy0 - 1; cy <= cy0 + k; cy += 1) {
    for (let cx = cx0 - 1; cx <= cx0 + k; cx += 1) {
      if (wasBlasted(grid, initial, { cx, cy })) return true;
    }
  }
  return false;
}

interface TileBox {
  cx0: number;
  cy0: number;
  k: number;
}

/** Reads one tile (tile coords `tx`, `ty`). `initial` is the cell array at level load. */
export function readTile(
  grid: TerrainGrid,
  initial: Uint8Array,
  tile: { tx: number; ty: number; k: number }
): TileState {
  const box = { cx0: tile.tx * tile.k, cy0: tile.ty * tile.k, k: tile.k };
  const filled: boolean[] = [];
  let slot = EMPTY_CELL;
  for (let dy = 0; dy < tile.k; dy += 1) {
    for (let dx = 0; dx < tile.k; dx += 1) {
      const cellSlot = getCellSlot(grid, box.cx0 + dx, box.cy0 + dy);
      const on = isBreakable(grid, cellSlot);
      filled.push(on);
      if (on && slot === EMPTY_CELL) slot = cellSlot;
    }
  }
  const intact = filled.every(Boolean);
  const cracked = slot !== EMPTY_CELL && hasBlastNear(grid, initial, box);
  return { slot, filled, intact, cracked };
}
