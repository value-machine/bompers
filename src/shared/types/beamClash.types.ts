import type { ElementPairReaction } from "@/shared/types/element.types";
import type { Vec2 } from "@/shared/types/gameGeometry.types";

/**
 * Types of the beam-clash rule (`src/shared/utils/beamClash.ts`; owner, beam-clash D1), kept
 * here so a feature's state types can hold a clash.
 */

/** Two beams ending each other this step. */
export interface BeamClash {
  /** Where they touch. */
  at: Vec2;
  /** The elements' reaction from the pair table (`elementPairs`). */
  reaction: ElementPairReaction;
  /** Indexes of the two beams in the list given to the rule. */
  beams: readonly [number, number];
}
