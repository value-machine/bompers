/**
 * Point orbs (GDD § 5: points falling from the roof). Pure data; the collectibles sim mutates
 * it in place. Positions are the orb centre, world units, y down.
 */
export interface PointOrb {
  id: number;
  /** Index into the level's collectibles: the point this orb falls onto. */
  pointIndex: number;
  x: number;
  y: number;
  /** The authored point: the orb falls until it reaches this y, then hovers. */
  restY: number;
  vy: number;
}

export interface CollectiblesState {
  orbs: PointOrb[];
  /** Sim seconds until the next spawn attempt. */
  spawnTimer: number;
  /** Next collectible point to try (round-robin). */
  nextPointIndex: number;
  nextId: number;
}

/** A point orb a player touched this step. */
export interface OrbCollected {
  slot: number;
  x: number;
  y: number;
}
