import type { Rect, Shape2D, Vec2 } from "@/shared/types/gameGeometry.types";
import type { LevelMotion } from "@/shared/types/levelMotion.types";

/**
 * The engine's level model. Maps 1:1 onto the level file contract (HTML + inline SVG; importer:
 * a later lap). Holds geometry and gameplay data only; looks, sounds and behaviours are string
 * IDs resolved through the content catalog. Units: world units, origin top-left, y down.
 */
export type TerrainShape = Shape2D;

/**
 * One terrain shape. The material sets behaviour (breakable, friction, sound, surface pattern);
 * the colour is looks only, independent of the material (LEVEL_FORMAT § 6).
 */
export interface TerrainPiece {
  shape: TerrainShape;
  materialId: string;
  /** Catalog colour ID; the normaliser fills the material's default when absent. */
  colorId?: string;
  /** Effect when cells of this piece are destroyed (default: the material's). */
  effectId?: string;
  /** Sound on destroy / impact (default: the material's). */
  soundId?: string;
  behaviorId?: string;
}

export interface LevelMeta {
  levelId: string;
  title: string;
  author?: string;
  /** The AI agent that wrote the file, if any. */
  agent?: string;
  description?: string;
}

export interface LevelSettings {
  /** World units per terrain cell. */
  cellSize: number;
  /** Multiplier of the engine's default gravity. */
  gravity: number;
  /** Round length override, seconds. */
  matchDurationS?: number;
  /**
   * Weapons override (`data-weapons`): weapon item IDs the crates hold; empty = none. Unset = the
   * lobby's choice (level-direction D6). Wins over the lobby, like `matchDurationS`.
   */
  weaponIds?: readonly string[];
}

/** A spawn point for sky crates; which weapon falls is the match's weapons setting. */
export interface LevelDrop {
  at: Vec2;
}

export interface LevelCollectible {
  at: Vec2;
  itemId: string;
}

/**
 * A moving part (LEVEL_FORMAT § 11): terrain pieces that move together along one motion. The
 * pieces stay in `LevelDefinition.terrain` at their rest pose; `terrainIndices` names them.
 * The arena keeps them out of its static samples and runs each as a moving body.
 */
export interface LevelMover {
  motion: LevelMotion;
  /** World point the part turns about (a named anchor of its pieces' bounding box). */
  pivot: Vec2;
  /** Indices into `LevelDefinition.terrain`, ascending. */
  terrainIndices: readonly number[];
  /**
   * Author-declared sound IDs (silent by default, moving-parts B2): `move` at its fastest point
   * (a woosh), `end` at each turning point (`motionCuePoints`).
   */
  sounds?: { move?: string; end?: string };
}

/**
 * A placed object (level-objects D5): a recipe built into terrain pieces at import. The pieces
 * stay in `LevelDefinition.terrain` (in document order) and `terrainIndices` names them, like a
 * mover's, so a later lap can lift an object out into its own body (physics) without a format change.
 */
export interface LevelObject {
  /** Recipe kind, e.g. `tree`. */
  kind: string;
  /** Recipe variant, e.g. `pine`. */
  variant: string;
  /** The box it was built in, after clamping; it stands on the box's bottom centre. */
  box: Rect;
  /** The seed its parts were built from. */
  seed: number;
  /** Indices into `LevelDefinition.terrain`, ascending. */
  terrainIndices: readonly number[];
}

export interface LevelDefinition {
  formatVersion: number;
  meta: LevelMeta;
  settings: LevelSettings;
  worldSize: { w: number; h: number };
  /** Applied in order: a later piece overwrites the cells of an earlier one. */
  terrain: readonly TerrainPiece[];
  /** Player spawn candidates: feet point (bottom-centre of the player). At least 2. */
  spawns: readonly Vec2[];
  drops: readonly LevelDrop[];
  collectibles: readonly LevelCollectible[];
  /** Moving parts; absent or empty = a static level. */
  movers?: readonly LevelMover[];
  /** Placed objects; absent or empty = none. Their pieces are already in `terrain`. */
  objects?: readonly LevelObject[];
  /** The in-bounds area; leaving it eliminates a player. */
  bounds: Rect;
}

/** A level after normalisation, plus what was corrected. */
export interface NormalizedLevel {
  level: LevelDefinition;
  warnings: string[];
}
