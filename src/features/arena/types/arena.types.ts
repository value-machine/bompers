import type { MaterialSurface } from "@/shared/types/terrainSurface.types";

/**
 * What one kind of terrain cell is: material behaviour (from the catalog) plus the piece's
 * colour. Cells store an index into `TerrainGrid.slots`; slot 0 is always empty.
 */
export interface TerrainCellSlot {
  materialId: string;
  /** Catalog colour ID (palette `terrainSwatches`); looks only. */
  colorId: string;
  /** The material's `toughness`: blasts clear it where distance × toughness ≤ crater reach; `null` = unbreakable. */
  toughness: number | null;
  /** 0 = ice … 1 = grippy (the material's `friction`). */
  friction: number;
  /** Surface pattern the renderer draws (the material's `surface`). */
  surface: MaterialSurface;
  /** Fire spreads through it and burns it away (the material's `burns`). */
  burns: boolean;
  /** Fuel touching it never catches (the material's `douses`). */
  douses: boolean;
}

export const EMPTY_CELL = 0;

/**
 * Mutable terrain of the arena: a grid of samples (`cellSize` apart, 4 units by default), each
 * with a material slot and a signed distance to the nearest terrain edge (terrain-field D2). The
 * simulation mutates it in place (blasts) through one write path; the renderer redraws only
 * chunks listed in `dirtyChunks`.
 */
export interface TerrainGrid {
  /** Sample spacing, world units (the level's `data-cell-size`). */
  cellSize: number;
  widthCells: number;
  heightCells: number;
  /** Row-major slot index per sample (0 = empty). */
  cells: Uint8Array;
  /**
   * Row-major signed distance from each sample centre to the nearest terrain edge, world units:
   * positive inside, negative outside, clamped to ± `FIELD_BAND_SAMPLES` samples. A sample is
   * solid exactly while its distance is positive (its slot is then non-empty).
   */
  distance: Float32Array;
  /** Row-major 1 = anchored (unbreakable, or in the world's bottom row) at load (blast-power D20). */
  anchored: Uint8Array;
  /** Slot table; index 0 is the empty slot. */
  slots: TerrainCellSlot[];
  /** Chunk edge length in cells. */
  chunkCells: number;
  chunksX: number;
  chunksY: number;
  /** Chunk indices (row-major) changed since the renderer last drew them. */
  dirtyChunks: Set<number>;
}
