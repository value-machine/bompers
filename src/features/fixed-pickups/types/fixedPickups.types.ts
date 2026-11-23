/** Catalog items that sit fixed on a collectible point and come back after a respawn time. */
export type FixedPickupItem = "dive-reset" | "health";

/**
 * A fixed pickup on its collectible point, present from the match start: a headbutt reset
 * (`dive-reset`, headbutt-reset D2, D3) or a health pickup (`health`, health-pickups D3, D4). Who
 * may take one is the match's call; once taken it is gone for its item's `respawnSeconds`.
 */
export interface FixedPickup {
  itemId: FixedPickupItem;
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

/** A fixed pickup a player took this step: `match` gives the item's effect to that player. */
export interface FixedPickupTaken {
  itemId: FixedPickupItem;
  slot: number;
  x: number;
  y: number;
}
