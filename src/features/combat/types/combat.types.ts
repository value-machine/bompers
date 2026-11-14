import type { Vec2 } from "@/shared/types/gameGeometry.types";

/**
 * Combat slice of the game state (GDD § 3): per-player fighter state keyed by player `id`,
 * rockets in flight, and the sim event log other systems read (sound, match
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
  /** Fire held on the previous step (edge detection: one action per press). */
  prevFire: boolean;
  /** Seconds until the next shot is allowed. */
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

/** What dealt a hit. The dive lap owns "dive"; new attacks add their source here. */
export type HitSource = "rocket" | "dive";
export type EliminationCause = HitSource | "out-of-bounds";
/** Damage table row a hit uses (`combat.hitDamage`): body contact or explosion. */
export type HitKind = "contact" | "blast";
/** Where on the victim a hit lands, relative to the victim's facing. */
export type HitZone = "front" | "back";

/** One hit for `applyHit`. Knockback / impulse stays with the attack; this is damage only. */
export interface Hit {
  victimSlot: number;
  /** null for environment damage. */
  attackerSlot: number | null;
  kind: HitKind;
  source: HitSource;
  /** World point where the hit landed (for effects). */
  contactPoint: Vec2;
  /** Direction the hit travels, from the attacker / blast into the victim (need not be unit). */
  direction: Vec2;
}

/** Sim events. The sound lap maps `type` (and the material IDs) to sounds; match rules read hits / eliminations. */
export type CombatEventBody =
  | {
      type: "playerHit";
      victimSlot: number;
      byPlayerSlot: number | null;
      source: HitSource;
      kind: HitKind;
      zone: HitZone;
      /** Chunks removed (0 = a configured bounce-only hit). */
      damage: number;
      healthLeft: number;
      x: number;
      y: number;
    }
  | {
      type: "playerEliminated";
      victimSlot: number;
      byPlayerSlot: number | null;
      cause: EliminationCause;
    }
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
  /** Recent events, oldest first; pruned after `combat.eventRetentionSeconds`. */
  events: CombatEvent[];
  nextSeq: number;
  nextEntityId: number;
}
