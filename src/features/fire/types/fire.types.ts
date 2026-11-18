import type { Vec2 } from "@/shared/types/gameGeometry.types";
import type { SampleFront } from "@/shared/types/sampleFront.types";

/**
 * Fire on one body's field (fire-spread b1; blast-power D5, D6, D18; mover-materials-l2 D3):
 * every sample has the sim time it catches fire (its arrival time); lit samples burn for a while
 * and are then removed. Sample indices are that body's grid's (`cy * widthCells + cx`).
 */
export interface GroundFire {
  /** The fire front: arrival times and pending ignitions (the arena's shared sample front). */
  front: SampleFront;
  /**
   * Sim seconds each sample catches (or is due to catch); `Infinity` = not reached. The same
   * array as `front.arriveAt`, under the name it has for fire.
   */
  igniteAt: Float32Array;
  /** The terrain's `frozenVersion` this fire last checked its burning samples against. */
  frozenSeen: number;
  /** Lit samples in ignition order (constant burn time ⇒ also burn-out order). */
  lit: number[];
  /** First entry of `lit` still burning. */
  litHead: number;
  /** Burnt-out samples waiting for the next batch removal. */
  dueOut: number[];
  /** 1 where fire stopped at a breakable non-fuel sample (earth): drawn scorched. */
  scorched: Uint8Array;
  /** Bumps whenever lit, burnt or scorched samples change (the renderer redraws on change). */
  version: number;
}

/**
 * The fire slice of the game state: the fire on every body of the arena and the torch's sprays.
 * Blobs on fire are their own feature (`blob-fire`).
 */
export interface FireState {
  /**
   * One ground fire per body, in the arena's body order (`bodyGrids`): 0 = the static terrain,
   * then each moving part's own field (mover-materials-l2 D3).
   */
  grounds: GroundFire[];
  /** Sim time of the next batch removal (one beat for all bodies). */
  nextBurnOutAt: number;
  /** The torch sprays of the last step, for the renderer. */
  sprays: TorchSpray[];
}

/** One torch spray this step: the helmet it comes from and where each cone ray ended. */
export interface TorchSpray {
  slot: number;
  origin: Vec2;
  /** End of each ray (first terrain met, or full length). */
  ends: Vec2[];
  /** Sim time of the step it sprayed in. */
  atSeconds: number;
}
