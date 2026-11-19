import type { WeaponItemId } from "@/shared/types/weaponItems.types";

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
  /** Sim seconds since it appeared (render pop-in). */
  ageSeconds: number;
  /** Sim seconds since it reached its point (render settle squash); 0 while falling. */
  restSeconds: number;
}

/** A weapon crate: holds one weapon (`WeaponItemId`). */
export interface WeaponCrate {
  id: number;
  itemId: WeaponItemId;
  /** Bottom-centre of the crate box (like the player feet point). */
  x: number;
  y: number;
  vy: number;
  grounded: boolean;
  /** Sim seconds since it was released (render pop-in). */
  ageSeconds: number;
  /** Sim seconds since it last landed (render squash and dust); 0 while falling. */
  groundedSeconds: number;
}

/** Weapon crates in the arena and their drop schedule (round-robin over the level's drop points). */
export interface WeaponCratesState {
  list: WeaponCrate[];
  /** Sim seconds until the next drop attempt. */
  dropTimer: number;
  /** Next drop point to release a crate (round-robin). */
  nextDropIndex: number;
  /** Counts released crates; picks the weapon among a drop point's items (homing-missiles D4). */
  nextItemIndex: number;
  nextId: number;
  /** Crate landings over the match (monotonic; the landing sound). */
  landCount: number;
}

/**
 * A taken point orb or weapon crate, kept for the render burst (pickup-juice D1, D3): where it
 * was, what it held (`point-orb` or the crate's weapon), its id and its age. Gone once its longest
 * part is over (`pickupBurstSeconds`).
 */
export interface PickupBurst {
  id: number;
  itemId: "point-orb" | WeaponItemId;
  x: number;
  y: number;
  ageSeconds: number;
}

/**
 * A headbutt reset (catalog item `dive-reset`): a fixed dive-refill pickup on its collectible
 * point. Only a player whose dive charge is spent can take it (the match filters who is passed
 * in); it is then gone for `collectibles.diveRefill.respawnSeconds` (headbutt-reset D2, D3).
 */
export interface DiveRefillPickup {
  /** Index into the level's collectibles. */
  pointIndex: number;
  /** Centre, world units (the authored point). */
  x: number;
  y: number;
  /** Seconds until it is back; 0 = present. */
  respawnTimer: number;
  /** Seconds since it last appeared (the render pop-in); counts only while present. */
  presentSeconds: number;
}

/** A headbutt reset a player took this step: `match` refills that player's dive. */
export interface DiveRefillCollected {
  slot: number;
  x: number;
  y: number;
}

export interface CollectiblesState {
  orbs: PointOrb[];
  /** Headbutt resets, one per `dive-reset` collectible point, from the match start. */
  diveRefills: DiveRefillPickup[];
  crates: WeaponCratesState;
  /** Taken orbs and crates bursting (render only, aged once per step by `stepCollectibles`). */
  bursts: PickupBurst[];
  /** Point orbs taken per player slot over the match (monotonic; the orb chime). */
  orbCounts: Record<number, number>;
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
