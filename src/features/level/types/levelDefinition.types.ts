import type { Rect, Shape2D, Vec2 } from "@/shared/types/gameGeometry.types";

/**
 * The engine's level model. Maps 1:1 onto the level file contract (HTML + inline SVG; importer:
 * a later lap). Holds geometry and gameplay data only; looks, sounds and behaviours are string
 * IDs resolved through the content catalog. Units: world units, origin top-left, y down.
 */
export type TerrainShape = Shape2D;

/** platform = indestructible terrain; destructible = blasts clear it. */
export type TerrainRole = "platform" | "destructible";

export interface TerrainPiece {
  shape: TerrainShape;
  role: TerrainRole;
  materialId: string;
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
}

export interface LevelDrop {
  at: Vec2;
  /** Item IDs that may drop here. */
  itemIds: readonly string[];
}

export interface LevelCollectible {
  at: Vec2;
  itemId: string;
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
  /** The in-bounds area; leaving it eliminates a player. */
  bounds: Rect;
}

/** A level after normalisation, plus what was corrected. */
export interface NormalizedLevel {
  level: LevelDefinition;
  warnings: string[];
}
