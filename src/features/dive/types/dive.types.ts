import type { Vec2 } from "@/shared/types/gameGeometry.types";

/**
 * One dive headbutt that connected. The first six fields are the `Hit` given to combat's
 * `applyHit` (spelled out here: `types/` may not import another feature); `landed`, `zone` and
 * `damage` are what it returned; `impulse` is the knockback the dive applied.
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
  /** False when combat refused the damage (spawn protection): the blobs still bounce. */
  landed: boolean;
  zone: "front" | "back";
  /** Health chunks removed (0 when not landed), from `combat.hitDamage.contact`. */
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
  /** Hits made on the last step (also emitted by combat as `playerHit` events). */
  hits: DiveHit[];
  recentHits: RecentHit[];
}
