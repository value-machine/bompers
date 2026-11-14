import type { Circle, Rect } from "@/shared/types/gameGeometry.types";
import {
  EMPTY_CELL,
  type TerrainCellSlot,
  type TerrainGrid,
} from "@/features/arena/types/arena.types";

/**
 * Terrain cell grid: collision queries and destruction. Pure TS; mutates the grid it is given.
 * Out-of-range cells read as empty, so open map edges need no special case.
 */
export const DEFAULT_CHUNK_CELLS = 16;

export interface TerrainGridSize {
  cellSize: number;
  widthCells: number;
  heightCells: number;
  chunkCells?: number;
}

const EMPTY_SLOT: TerrainCellSlot = {
  role: "platform",
  materialId: "",
  destructible: false,
  lookToken: "",
};

export function createTerrainGrid(size: TerrainGridSize): TerrainGrid {
  const chunkCells = size.chunkCells ?? DEFAULT_CHUNK_CELLS;
  const chunksX = Math.ceil(size.widthCells / chunkCells);
  const chunksY = Math.ceil(size.heightCells / chunkCells);
  const dirtyChunks = new Set<number>();
  for (let i = 0; i < chunksX * chunksY; i += 1) dirtyChunks.add(i);
  return {
    cellSize: size.cellSize,
    widthCells: size.widthCells,
    heightCells: size.heightCells,
    cells: new Uint8Array(size.widthCells * size.heightCells),
    slots: [EMPTY_SLOT],
    chunkCells,
    chunksX,
    chunksY,
    dirtyChunks,
  };
}

/** Index of the slot for this material / destructibility, added on first use. */
export function slotFor(grid: TerrainGrid, slot: TerrainCellSlot): number {
  const found = grid.slots.findIndex(
    (s, i) =>
      i > 0 &&
      s.role === slot.role &&
      s.materialId === slot.materialId &&
      s.destructible === slot.destructible
  );
  if (found > 0) return found;
  grid.slots.push(slot);
  return grid.slots.length - 1;
}

const inGrid = (grid: TerrainGrid, cx: number, cy: number): boolean =>
  cx >= 0 && cy >= 0 && cx < grid.widthCells && cy < grid.heightCells;

const chunkIndexOfCell = (grid: TerrainGrid, cx: number, cy: number): number =>
  Math.floor(cy / grid.chunkCells) * grid.chunksX + Math.floor(cx / grid.chunkCells);

/** Slot index of a cell (0 = empty, also outside the grid). */
export function getCellSlot(grid: TerrainGrid, cx: number, cy: number): number {
  if (!inGrid(grid, cx, cy)) return EMPTY_CELL;
  return grid.cells[cy * grid.widthCells + cx] ?? EMPTY_CELL;
}

/** Material info of a cell, or null when empty. */
export function getCellInfo(grid: TerrainGrid, cx: number, cy: number): TerrainCellSlot | null {
  const slot = getCellSlot(grid, cx, cy);
  return slot === EMPTY_CELL ? null : (grid.slots[slot] ?? null);
}

/** Writes one cell and marks its chunk dirty when the value changes. */
export function setCellSlot(
  grid: TerrainGrid,
  cell: { cx: number; cy: number; slot: number }
): void {
  const { cx, cy, slot } = cell;
  if (!inGrid(grid, cx, cy)) return;
  const index = cy * grid.widthCells + cx;
  if (grid.cells[index] === slot) return;
  grid.cells[index] = slot;
  grid.dirtyChunks.add(chunkIndexOfCell(grid, cx, cy));
}

/** True when the world point lies in a non-empty cell. */
export function isSolidAt(grid: TerrainGrid, x: number, y: number): boolean {
  const size = grid.cellSize;
  return getCellSlot(grid, Math.floor(x / size), Math.floor(y / size)) !== EMPTY_CELL;
}

/** Cell range a world rect overlaps (edges touching a cell boundary do not count). */
export function cellRangeOf(grid: TerrainGrid, rect: Rect) {
  const size = grid.cellSize;
  return {
    minX: Math.floor(rect.x / size),
    minY: Math.floor(rect.y / size),
    maxX: Math.ceil((rect.x + rect.w) / size) - 1,
    maxY: Math.ceil((rect.y + rect.h) / size) - 1,
  };
}

/** True when any cell the rect overlaps is non-empty. The collision query for bodies. */
export function rectHitsSolid(grid: TerrainGrid, rect: Rect): boolean {
  const range = cellRangeOf(grid, rect);
  for (let cy = range.minY; cy <= range.maxY; cy += 1) {
    for (let cx = range.minX; cx <= range.maxX; cx += 1) {
      if (getCellSlot(grid, cx, cy) !== EMPTY_CELL) return true;
    }
  }
  return false;
}

/**
 * Top of the first terrain surface under a span (x .. x + w) at or below `y`, scanning cell rows
 * down to `y + range`; null when there is none. For contact shadows of pickups and rockets.
 * Second copy: `features/player/services/playerController.ts` `scanGroundBelow` scans the same way
 * for the player body.
 */
export function surfaceBelow(
  grid: TerrainGrid,
  span: { x: number; y: number; w: number; range: number }
): number | null {
  const size = grid.cellSize;
  for (let top = Math.ceil(span.y / size) * size; top <= span.y + span.range; top += size) {
    if (rectHitsSolid(grid, { x: span.x, y: top, w: span.w, h: 1 })) return top;
  }
  return null;
}

/** What a blast removed: total cells and the count per material ID (for destroy effects / sounds). */
export interface ClearedCells {
  removed: number;
  byMaterial: Record<string, number>;
}

/**
 * Blasts a circle out of the terrain: destructible cells whose centre lies inside become empty;
 * other cells stay. Returns what was removed, per material.
 */
export function clearCircle(grid: TerrainGrid, circle: Circle): ClearedCells {
  const size = grid.cellSize;
  const range = cellRangeOf(grid, {
    x: circle.x - circle.radius,
    y: circle.y - circle.radius,
    w: circle.radius * 2,
    h: circle.radius * 2,
  });
  const radiusSq = circle.radius * circle.radius;
  const cleared: ClearedCells = { removed: 0, byMaterial: {} };
  for (let cy = range.minY; cy <= range.maxY; cy += 1) {
    for (let cx = range.minX; cx <= range.maxX; cx += 1) {
      const info = getCellInfo(grid, cx, cy);
      if (info?.destructible !== true) continue;
      const dx = (cx + 0.5) * size - circle.x;
      const dy = (cy + 0.5) * size - circle.y;
      if (dx * dx + dy * dy > radiusSq) continue;
      setCellSlot(grid, { cx, cy, slot: EMPTY_CELL });
      cleared.removed += 1;
      cleared.byMaterial[info.materialId] = (cleared.byMaterial[info.materialId] ?? 0) + 1;
    }
  }
  return cleared;
}

/** Returns the dirty chunk indices and clears the set (called by the renderer). */
export function takeDirtyChunks(grid: TerrainGrid): number[] {
  const dirty = [...grid.dirtyChunks];
  grid.dirtyChunks.clear();
  return dirty;
}
