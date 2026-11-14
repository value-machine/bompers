import type { Vec2 } from "@/shared/types/gameGeometry.types";

/** Where on the victim a hit landed, from the victim's facing (GDD § 3; back hits hurt more). */
export type HitZone = "front" | "back";

/**
 * One landed dive headbutt. This is the seam to the combat feature: its `applyHit` takes these
 * (zone-aware damage in health chunks); until then the dive only tallies them.
 */
export interface DiveHit {
  attackerId: string;
  victimId: string;
  zone: HitZone;
  /** Health chunks, from `tunables.dive.frontHitDamage` / `backHitDamage`. */
  damage: number;
  /** Total velocity change the hit gave the victim (collision exchange + strike), units / s. */
  impulse: Vec2;
  /** Contact point, world units. */
  at: Vec2;
}

export type DivePhase = "idle" | "windup" | "travel" | "recovery";

/** One player's dive state. Timers are seconds. */
export interface DiveMotion {
  phase: DivePhase;
  /** Seconds spent in the current phase, and how long it lasts. */
  phaseSeconds: number;
  phaseDuration: number;
  /** Unit dive direction: the aim at the press, then the travel direction (bounces turn it). */
  dirX: number;
  dirY: number;
  /** Terrain bounces left in this dive. */
  bouncesLeft: number;
  /** One dive per airtime: spent at the press, back on ground contact (or a refreshing hit). */
  charged: boolean;
  /** Seconds until the next dive may start. */
  cooldown: number;
  /** Seconds a fire press is still remembered. */
  fireBuffer: number;
  /** Held state on the previous step (edge detection). */
  prevFire: boolean;
  prevJump: boolean;
  /** Victims already hit by this dive (one hit per victim per dive). */
  hitVictimIds: string[];
  /** The current recovery is a head-on terrain bonk (stun). */
  bonked: boolean;
  /** Seconds left of reduced steering after being hit. */
  stagger: number;
}

/** Debug tally per player (phase-1 stand-in for health). */
export interface HitTally {
  dealt: number;
  frontTaken: number;
  backTaken: number;
  damageTaken: number;
}

/** A landed hit kept briefly for the impact effect. */
export interface RecentHit {
  hit: DiveHit;
  ageSeconds: number;
}

/** The dive slice of the game state. */
export interface DiveState {
  /** Index into `tunables.dive.options` (phase-1 prototype switch, keys 1 / 2 / 3). */
  optionIndex: number;
  /** By player id. */
  motions: Record<string, DiveMotion>;
  tallies: Record<string, HitTally>;
  /** Hits landed on the last step (what combat's `applyHit` will consume). */
  hits: DiveHit[];
  recentHits: RecentHit[];
}
