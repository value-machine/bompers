import type { Circle, Rect } from "@/shared/types/gameGeometry.types";
import {
  TERRAIN_CELL,
  type LevelData,
  type TerrainCellKind,
  type TerrainGrid,
} from "@/features/arena/types/arena.types";

/**
 * Terrain cell grid: collision queries and destruction. Pure TS; mutates the grid it is given.
 * Out-of-range cells read as empty, so open map edges need no special casing.
 */
export const DEFAULT_CHUNK_CELLS = 16;

export interface TerrainGridSize {
  cellSize: number;
  widthCells: number;
  heightCells: number;
  chunkCells?: number;
}

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
    chunkCells,
    chunksX,
    chunksY,
    dirtyChunks,
  };
}

const inGrid = (grid: TerrainGrid, cx: number, cy: number): boolean =>
  cx >= 0 && cy >= 0 && cx < grid.widthCells && cy < grid.heightCells;

const chunkIndexOfCell = (grid: TerrainGrid, cx: number, cy: number): number =>
  Math.floor(cy / grid.chunkCells) * grid.chunksX + Math.floor(cx / grid.chunkCells);

export function getCell(grid: TerrainGrid, cx: number, cy: number): TerrainCellKind {
  if (!inGrid(grid, cx, cy)) return TERRAIN_CELL.empty;
  return grid.cells[cy * grid.widthCells + cx] as TerrainCellKind;
}

/** Writes one cell and marks its chunk dirty when the value changes. */
export function setCell(
  grid: TerrainGrid,
  cell: { cx: number; cy: number; kind: TerrainCellKind }
): void {
  const { cx, cy, kind } = cell;
  if (!inGrid(grid, cx, cy)) return;
  const index = cy * grid.widthCells + cx;
  if (grid.cells[index] === kind) return;
  grid.cells[index] = kind;
  grid.dirtyChunks.add(chunkIndexOfCell(grid, cx, cy));
}

/** Builds the grid a level describes. */
export function buildTerrainFromLevel(level: LevelData): TerrainGrid {
  const grid = createTerrainGrid(level);
  for (const block of level.blocks) {
    const kind = block.kind === "solid" ? TERRAIN_CELL.solid : TERRAIN_CELL.destructible;
    for (let cy = block.y; cy < block.y + block.height; cy += 1) {
      for (let cx = block.x; cx < block.x + block.width; cx += 1) {
        setCell(grid, { cx, cy, kind });
      }
    }
  }
  return grid;
}

/** True when the world point lies in a non-empty cell. */
export function isSolidAt(grid: TerrainGrid, x: number, y: number): boolean {
  const cx = Math.floor(x / grid.cellSize);
  const cy = Math.floor(y / grid.cellSize);
  return getCell(grid, cx, cy) !== TERRAIN_CELL.empty;
}

/** Cell range a world rect overlaps (edges touching a cell boundary do not count). */
function cellRangeOf(grid: TerrainGrid, rect: Rect) {
  const size = grid.cellSize;
  return {
    minX: Math.floor(rect.x / size),
    minY: Math.floor(rect.y / size),
    maxX: Math.ceil((rect.x + rect.width) / size) - 1,
    maxY: Math.ceil((rect.y + rect.height) / size) - 1,
  };
}

/** True when any cell the rect overlaps is non-empty. The collision query for bodies. */
export function rectHitsSolid(grid: TerrainGrid, rect: Rect): boolean {
  const range = cellRangeOf(grid, rect);
  for (let cy = range.minY; cy <= range.maxY; cy += 1) {
    for (let cx = range.minX; cx <= range.maxX; cx += 1) {
      if (getCell(grid, cx, cy) !== TERRAIN_CELL.empty) return true;
    }
  }
  return false;
}

/**
 * Blasts a circle out of the terrain: destructible cells whose center lies inside become empty;
 * solid cells stay. Returns how many cells were removed.
 */
export function clearCircle(grid: TerrainGrid, circle: Circle): number {
  const size = grid.cellSize;
  const range = cellRangeOf(grid, {
    x: circle.x - circle.radius,
    y: circle.y - circle.radius,
    width: circle.radius * 2,
    height: circle.radius * 2,
  });
  const radiusSq = circle.radius * circle.radius;
  let removed = 0;
  for (let cy = range.minY; cy <= range.maxY; cy += 1) {
    for (let cx = range.minX; cx <= range.maxX; cx += 1) {
      if (getCell(grid, cx, cy) !== TERRAIN_CELL.destructible) continue;
      const dx = (cx + 0.5) * size - circle.x;
      const dy = (cy + 0.5) * size - circle.y;
      if (dx * dx + dy * dy > radiusSq) continue;
      setCell(grid, { cx, cy, kind: TERRAIN_CELL.empty });
      removed += 1;
    }
  }
  return removed;
}

/** Returns the dirty chunk indices and clears the set (called by the renderer). */
export function takeDirtyChunks(grid: TerrainGrid): number[] {
  const dirty = [...grid.dirtyChunks];
  grid.dirtyChunks.clear();
  return dirty;
}
