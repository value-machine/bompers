import { easeOutQuad, popInScale } from "@/shared/utils/easing";
import type { FixedPickup } from "@/features/fixed-pickups/types/fixedPickups.types";

/**
 * The one life cycle every fixed pickup look follows (headbutt reset, health pickup; GAME_JUICE
 * § 6): present (with a pop-in when it comes back), popping or cracking when taken, then a faint
 * copy regrowing on its point until it is back. Derived from the sim timers, render only.
 */
export interface FixedPickupTiming {
  /** Pop-in when it is back, seconds (GAME_JUICE `squash` window). */
  popInSeconds: number;
  /** The take burst, seconds (GAME_JUICE `linger` window). */
  popSeconds: number;
  /** Regrowing ghost: scale at the start and end of the respawn. */
  regrow: { from: number; to: number };
}

export type FixedPickupPhase =
  | { kind: "present"; popIn: number }
  | { kind: "popping"; t: number }
  | { kind: "regrowing"; grow: number };

/** Which state the pickup is drawn in, from its sim timers. */
export function fixedPickupPhase(
  pickup: Pick<FixedPickup, "respawnTimer" | "presentSeconds">,
  args: { respawnSeconds: number; timing: FixedPickupTiming }
): FixedPickupPhase {
  const { popInSeconds, popSeconds, regrow } = args.timing;
  if (pickup.respawnTimer === 0) {
    return { kind: "present", popIn: popInScale(pickup.presentSeconds / popInSeconds) };
  }
  const since = args.respawnSeconds - pickup.respawnTimer;
  if (since < popSeconds) return { kind: "popping", t: Math.max(0, since / popSeconds) };
  const span = Math.max(1e-6, args.respawnSeconds - popSeconds);
  const t = Math.min(1, (since - popSeconds) / span);
  return { kind: "regrowing", grow: regrow.from + (regrow.to - regrow.from) * easeOutQuad(t) };
}

/** What every look's place function gets each frame besides its pickup. */
export interface PlaceFixedPickupArgs {
  /** The item's respawn time (`fixedPickupRule`). */
  respawnSeconds: number;
  /** Animation clock, ms. */
  nowMs: number;
}

/** Idle bob offset, world units; each point is offset so neighbours do not bob in step. */
export const fixedPickupBob = (
  bob: { amplitude: number; periodMs: number },
  at: { nowMs: number; pointIndex: number }
): number =>
  Math.sin(((at.nowMs + at.pointIndex * 250) / bob.periodMs) * Math.PI * 2) * bob.amplitude;
