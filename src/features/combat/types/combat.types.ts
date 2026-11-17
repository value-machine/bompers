import type { Vec2 } from "@/shared/types/gameGeometry.types";
import type { WeaponItemId } from "@/shared/types/weaponItems.types";

/**
 * Combat slice of the game state (GDD § 3): per-player fighter state keyed by player `id`,
 * rockets in flight, and the sim event log other systems read (sound, match
 * rules, render). Pure data; the combat sim mutates it in place.
 */

/** A held weapon: the rocket launcher or the homing launcher (`WeaponItemId`). */
export interface HeldWeapon {
  itemId: WeaponItemId;
  ammo: number;
}

/** What flies: a straight rocket, or a homing missile that steers toward its target. */
export type RocketKind = "rocket" | "homing";

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
  kind: RocketKind;
  /** Homing only: the player id locked at launch (null = no target, flies straight). */
  targetId: string | null;
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
      /**
       * The lethal hit dealt more damage than the health left (it would end below 0). The
       * knockout bursts on the spot instead of flying first (knockout feature).
       */
      overkill: boolean;
      /** The victim's feet point and velocity right after the lethal hit's knockback. */
      x: number;
      y: number;
      vx: number;
      vy: number;
    }
  | {
      type: "rocketFired";
      kind: RocketKind;
      slot: number;
      x: number;
      y: number;
      dirX: number;
      dirY: number;
    }
  | { type: "explosion"; byPlayerSlot: number; x: number; y: number; radius: number }
  | {
      type: "terrainDestroyed";
      x: number;
      y: number;
      materialId: string;
      /** Catalog colour of the destroyed cells (debris colour). */
      colorId: string;
      cells: number;
      /** From the content catalog's material entry. */
      effectId: string;
      soundId: string;
    }
  | { type: "pickupSpawned"; itemId: WeaponItemId; x: number; y: number }
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
