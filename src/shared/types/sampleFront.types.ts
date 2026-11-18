import type { Vec2 } from "@/shared/types/gameGeometry.types";

/**
 * A front that spreads through touching samples of a grid: the time it reaches each sample plus
 * the pending arrivals. Shared because the fire and ice features both keep one in their state;
 * the spreading itself is `src/shared/utils/sampleFront.ts`.
 */
export interface SampleFront {
  /** Time the front reaches each sample (or is due to); `Infinity` = not reached. */
  arriveAt: Float32Array;
  /** Pending arrivals: a binary min-heap by time, ties by index (deterministic). */
  heapIndex: number[];
  heapTime: number[];
}

/** The grid a front or a ray reads: row-major samples, 0 = empty (the arena's terrain grid fits). */
export interface SampleField {
  /** Sample spacing, world units. */
  cellSize: number;
  widthCells: number;
  heightCells: number;
  cells: Uint8Array;
}

/**
 * A sample field placed in the world (mover-materials D4): the static terrain as it is, or a
 * moving part's own field in its pose this step. `toLocal` maps a world point into the field's
 * own coordinates, or gives null where the point is out of the field's reach; left out, the
 * field sits at the world's origin.
 */
export interface PosedField {
  field: SampleField;
  toLocal?: (p: Vec2) => Vec2 | null;
}
