import type { MaterialReactions } from "@/shared/types/element.types";
import type { Vec2 } from "@/shared/types/gameGeometry.types";
import type { LevelMotion, MotionPose } from "@/shared/types/levelMotion.types";
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
  /** What fire and cold do to it (the material's `reactions`, its row of the element table). */
  reactions: MaterialReactions;
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
  /** Bumps whenever a sample's slot or distance changes (layers drawn in the terrain's shape). */
  shapeVersion: number;
  /** Per chunk (row-major): bumps whenever a sample in it changes (`boxShapeVersion`). */
  chunkVersions: Uint32Array;
  /**
   * Row-major 1 = frozen (ice-element D5): the sample keeps its material but behaves like ice
   * while set — it reads `frozenFriction`, blasts do not cut it and fire does not enter it.
   * Written only through `setSampleFrozen` / `thawAround` (`frozenTerrain.ts`).
   */
  frozen: Uint8Array;
  /** Bumps whenever a `frozen` flag changes (consumers re-read on change). */
  frozenVersion: number;
  /** Grip of a frozen sample: the ice material's friction (1 until a level sets it). */
  frozenFriction: number;
  /**
   * Moving parts (LEVEL_FORMAT § 11): kinematic bodies with their own local field, never written
   * into this grid's samples (moving-parts D11). The solid queries read them; craters, fire and
   * the static outline do not. Empty for a static level and for a mover's own local field.
   */
  movers: MoverBody[];
}

/**
 * One moving part at run time: a local distance field of its pieces in rest pose, moved by its
 * pose (rotate about `pivot`, then shift). A world point is tested by mapping it back into the
 * rest pose (`unposePoint`) and reading the local field there.
 */
export interface MoverBody {
  motion: LevelMotion;
  /** World point the part turns about (rest pose). */
  pivot: Vec2;
  /** World position of the local field's top-left corner in the rest pose. */
  origin: Vec2;
  /** The part's pieces rasterised on their own grid (same sample spacing as the arena). */
  field: TerrainGrid;
  /** Pose this step and last step (the carry moves riders by the difference). */
  pose: MotionPose;
  prevPose: MotionPose;
  /** Farthest field point from the pivot plus the band: beyond it the part reads as air. */
  reach: number;
  /** Indices into the level's terrain pieces this part carries (the renderer draws them). */
  terrainIndices: readonly number[];
  /** Author-declared sound IDs (null = silent): at its fastest point, at each turning point. */
  sounds: { move: string | null; end: string | null };
}
