/**
 * Everything that drops from the sky (combat D2, match-rules D2): point orbs (GDD § 5: points
 * falling from the roof) and weapon crates (GDD § 3, § 4: weapons fall from the sky). Pure data;
 * the collectibles sim mutates it in place. World units, y down.
 */

/** A point orb. Position is the orb centre. */
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

/** A weapon crate (only the rocket launcher exists for the MVP). */
export interface WeaponCrate {
  id: number;
  itemId: "rocket-launcher";
  /** Bottom-centre of the crate box (like the player feet point). */
  x: number;
  y: number;
  vy: number;
  grounded: boolean;
}

/** Weapon crates in the arena and their drop schedule (round-robin over the level's drop points). */
export interface WeaponCratesState {
  list: WeaponCrate[];
  /** Sim seconds until the next drop attempt. */
  dropTimer: number;
  /** Next drop point to release a crate (round-robin). */
  nextDropIndex: number;
  nextId: number;
}

export interface CollectiblesState {
  orbs: PointOrb[];
  crates: WeaponCratesState;
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

/** What the weapon crates did this step; `match` hands it to combat, which arms the collector. */
export interface CrateStepResult {
  /** Crates released this step, in order. */
  spawned: { itemId: WeaponCrate["itemId"]; x: number; y: number }[];
  /** Crates taken this step, in order: the player in `slot` gets the weapon. */
  collected: { itemId: WeaponCrate["itemId"]; slot: number }[];
}
