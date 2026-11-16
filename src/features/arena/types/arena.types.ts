import type { MaterialSurface } from "@/shared/types/terrainSurface.types";

/**
 * What one kind of terrain cell is: material behaviour (from the catalog) plus the piece's
 * colour. Cells store an index into `TerrainGrid.slots`; slot 0 is always empty.
 */
export interface TerrainCellSlot {
  materialId: string;
  /** Catalog colour ID (palette `terrainSwatches`); looks only. */
  colorId: string;
  /** Blasts clear it (the material's `destructible`). */
  destructible: boolean;
  /** 0 = ice … 1 = grippy (the material's `friction`). */
  friction: number;
  /** Surface pattern the renderer draws (the material's `surface`). */
  surface: MaterialSurface;
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
