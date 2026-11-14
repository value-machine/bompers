/**
 * What one kind of terrain cell is: its material and whether blasts clear it. Cells store an
 * index into `TerrainGrid.slots`; slot 0 is always empty.
 */
export interface TerrainCellSlot {
  materialId: string;
  /** role "destructible" AND a destructible material. */
  destructible: boolean;
  /** Palette key from the material's catalog entry. */
  lookToken: string;
}

export const EMPTY_CELL = 0;

/**
 * Mutable cell grid of the arena. The simulation mutates it in place (blasts); the renderer
 * redraws only chunks listed in `dirtyChunks`.
 */
export interface TerrainGrid {
  cellSize: number;
  widthCells: number;
  heightCells: number;
  /** Row-major slot index per cell (0 = empty). */
  cells: Uint8Array;
  /** Slot table; index 0 is the empty slot. */
  slots: TerrainCellSlot[];
  /** Chunk edge length in cells. */
  chunkCells: number;
  chunksX: number;
  chunksY: number;
  /** Chunk indices (row-major) changed since the renderer last drew them. */
  dirtyChunks: Set<number>;
}
