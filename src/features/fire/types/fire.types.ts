import type { Vec2 } from "@/shared/types/gameGeometry.types";

/**
 * Fire on the terrain field (fire-spread b1; blast-power D5, D6, D18): every terrain sample has
 * the sim time it catches fire (its arrival time); lit samples burn for a while and are then
 * removed. Sample indices are the arena grid's (`cy * widthCells + cx`).
 */
export interface FireState {
  /** Sim seconds each sample catches (or is due to catch); `Infinity` = not reached. */
  igniteAt: Float32Array;
  /** Pending ignitions: a binary min-heap by time, ties by index (deterministic). */
  heapIndex: number[];
  heapTime: number[];
  /** Lit samples in ignition order (constant burn time ⇒ also burn-out order). */
  lit: number[];
  /** First entry of `lit` still burning. */
  litHead: number;
  /** Burnt-out samples waiting for the next batch removal. */
  dueOut: number[];
  /** Sim time of the next batch removal. */
  nextBurnOutAt: number;
  /** 1 where fire stopped at a breakable non-fuel sample (earth): drawn scorched. */
  scorched: Uint8Array;
  /** Bumps whenever lit, burnt or scorched samples change (the renderer redraws on change). */
  version: number;
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
