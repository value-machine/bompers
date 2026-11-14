import type { Vec2 } from "@/shared/types/gameGeometry.types";

/** Where on the victim a hit landed, from the victim's facing (GDD § 3; back hits hurt more). */
export type HitZone = "front" | "back";

/**
 * One landed dive headbutt. This is the seam to the combat feature: the first six fields are
 * exactly the `Hit` its `applyHit(world, hit)` takes, and `zone` / `damage` are what it returns
 * (and emits as `playerHit`). Until combat lands, the dive fills those two itself and only
 * tallies the hits.
 */
export interface DiveHit {
  victimSlot: number;
  attackerSlot: number;
  kind: "contact";
  source: "dive";
  /** Contact point, world units. */
  contactPoint: Vec2;
  /** Unit travel direction of the hit, attacker → victim. */
  direction: Vec2;
  zone: HitZone;
  /** Health chunks (phase 1: `tunables.dive.frontHitDamage` / `backHitDamage`). */
  damage: number;
  /** Total velocity change the hit gave the victim (collision exchange + strike), units / s. */
  impulse: Vec2;
}

export type DivePhase = "idle" | "windup" | "travel" | "recovery";

/** One player's dive state. Timers are seconds. */
export interface DiveMotion {
  phase: DivePhase;
  /** Seconds spent in the current phase, and how long it lasts. */
  phaseSeconds: number;
  phaseDuration: number;
  /** Unit dive direction, locked at the press (the aim snapped to 8 ways). */
  dirX: number;
  dirY: number;
  /** One dive per airtime: spent at the press, back on ground contact or on a hit. */
  charged: boolean;
  /** Seconds until the next dive may start. */
  cooldown: number;
  /** Seconds a fire press is still remembered. */
  fireBuffer: number;
  /** Fire held on the previous step (edge detection). */
  prevFire: boolean;
  /** The current recovery is a head-on terrain bonk (stun). */
  bonked: boolean;
  /** Seconds left of reduced steering after being hit. */
  stagger: number;
  /** Seconds since this player's dive last hit someone (the ricochet pose); Infinity = never. */
  sinceRicochet: number;
}

/** A landed hit kept briefly for the impact effect. */
export interface RecentHit {
  hit: DiveHit;
  ageSeconds: number;
}

/** The dive slice of the game state. */
export interface DiveState {
  /** By player id. */
  motions: Record<string, DiveMotion>;
  /** Hits landed on the last step. */
  hits: DiveHit[];
  recentHits: RecentHit[];
}
