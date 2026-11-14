/**
 * Combat slice of the game state (GDD § 3): per-player fighter state keyed by player `id`,
 * rockets in flight, weapon pickups, and the sim event log other systems read (sound, match
 * rules, render). Pure data; the combat sim mutates it in place.
 */

/** A held weapon. Only the rocket launcher exists for the MVP. */
export interface HeldWeapon {
  itemId: "rocket-launcher";
  ammo: number;
}

export interface FighterState {
  playerId: string;
  slot: number;
  /** Health chunks left (0 = eliminated, waiting for the step-4 respawn). */
  health: number;
  eliminated: boolean;
  /** Sim time (s) until which the player takes no damage (spawn protection; set by match rules). */
  invulnerableUntil: number;
  weapon: HeldWeapon | null;
  /** Fire held on the previous step (edge detection: one bash / shot per press). */
  prevFire: boolean;
  /** Seconds until the next bash / shot is allowed. */
  attackCooldown: number;
  /** Who hit this player last and when (sim seconds), for elimination credit. */
  lastHitBySlot: number | null;
  lastHitAt: number;
}

export interface RocketState {
  id: number;
  ownerSlot: number;
  ownerId: string;
  x: number;
  y: number;
  /** Unit flight direction (y down). */
  dirX: number;
  dirY: number;
  /** Seconds in flight. */
  age: number;
}

export interface PickupState {
  id: number;
  itemId: "rocket-launcher";
  /** Bottom-centre of the pickup box (like the player feet point). */
  x: number;
  y: number;
  vy: number;
  grounded: boolean;
}

export type DamageCause = "rocket" | "bash";
export type EliminationCause = DamageCause | "out-of-bounds";

/** Sim events. The sound lap maps `type` (and the material IDs) to sounds; match rules read hits / eliminations. */
export type CombatEventBody =
  | {
      type: "playerHit";
      victimSlot: number;
      byPlayerSlot: number | null;
      cause: DamageCause;
      healthLeft: number;
    }
  | {
      type: "playerEliminated";
      victimSlot: number;
      byPlayerSlot: number | null;
      cause: EliminationCause;
    }
  | { type: "bash"; slot: number; x: number; y: number; hit: boolean }
  | { type: "rocketFired"; slot: number; x: number; y: number; dirX: number; dirY: number }
  | { type: "explosion"; byPlayerSlot: number; x: number; y: number; radius: number }
  | {
      type: "terrainDestroyed";
      x: number;
      y: number;
      materialId: string;
      cells: number;
      /** From the content catalog's material entry. */
      effectId: string;
      soundId: string;
    }
  | { type: "pickupSpawned"; itemId: string; x: number; y: number }
  | { type: "pickupCollected"; itemId: string; slot: number };

export type CombatEvent = CombatEventBody & {
  /** Monotonic sequence number: consumers remember the last one they read. */
  seq: number;
  /** Sim time of the event, seconds. */
  timeSeconds: number;
};

export interface CombatState {
  /** Keyed by player id. */
  fighters: Map<string, FighterState>;
  rockets: RocketState[];
  pickups: PickupState[];
  /** Recent events, oldest first; pruned after `combat.eventRetentionSeconds`. */
  events: CombatEvent[];
  nextSeq: number;
  nextEntityId: number;
  /** Sim seconds until the next drop attempt, and the next drop point index (round-robin). */
  dropTimer: number;
  nextDropIndex: number;
}
