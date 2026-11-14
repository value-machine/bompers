import type { Rect, Vec2 } from "@/shared/types/gameGeometry.types";

/** What one terrain cell holds. Stored as bytes in `TerrainGrid.cells`. */
export const TERRAIN_CELL = {
  empty: 0,
  /** Indestructible base geometry: keeps the map playable. */
  solid: 1,
  /** Removed by blasts (`clearCircle`). */
  destructible: 2,
} as const;

export type TerrainCellKind = (typeof TERRAIN_CELL)[keyof typeof TERRAIN_CELL];

/** A filled rectangle of cells in a level file. Units: cells. */
export interface LevelBlock {
  x: number;
  y: number;
  width: number;
  height: number;
  kind: "solid" | "destructible";
}

/**
 * Level data format: plain JSON-able data, so maps can later live in files. Blocks are in
 * cells; points and the out-of-bounds zone are in world units. Later blocks overwrite earlier.
 */
export interface LevelData {
  id: string;
  name: string;
  /** World units per cell. */
  cellSize: number;
  widthCells: number;
  heightCells: number;
  blocks: readonly LevelBlock[];
  /** Player spawn candidates (feet position: bottom-center of the player). */
  spawnPoints: readonly Vec2[];
  /** Where weapon / power-up drops enter (GDD § 4: from above). */
  dropPoints: readonly Vec2[];
  /** Leaving this rect eliminates a player (DOC_APP_VISION: falling off the map). */
  outOfBounds: Rect;
}

/**
 * Mutable cell grid of the arena. The simulation mutates it in place (blasts); the renderer
 * redraws only chunks listed in `dirtyChunks`.
 */
export interface TerrainGrid {
  cellSize: number;
  widthCells: number;
  heightCells: number;
  /** Row-major, one `TerrainCellKind` per cell. */
  cells: Uint8Array;
  /** Chunk edge length in cells. */
  chunkCells: number;
  chunksX: number;
  chunksY: number;
  /** Chunk indices (row-major) changed since the renderer last drew them. */
  dirtyChunks: Set<number>;
}

/** The arena slice of the game state. */
export interface ArenaState {
  level: LevelData;
  terrain: TerrainGrid;
}
