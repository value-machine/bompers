import type { Vec2 } from "@/shared/types/gameGeometry.types";

/**
 * Types of the beam-clash rule (`src/shared/utils/beamClash.ts`; owner, beam-clash D1), kept
 * here so a feature's state types can hold a clash.
 */

/** What a held beam is made of; which pairs react is the rule's pair table. */
export type BeamElement = "fire" | "ice";

/** How a pair of elements reacts where their beams meet. */
export type BeamReaction = "steam";

/** Two beams ending each other this step. */
export interface BeamClash {
  /** Where they touch. */
  at: Vec2;
  reaction: BeamReaction;
  /** Indexes of the two beams in the list given to the rule. */
  beams: readonly [number, number];
}
