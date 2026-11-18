import type { Vec2 } from "@/shared/types/gameGeometry.types";
import type { SampleFront } from "@/shared/types/sampleFront.types";

/**
 * Frozen ground (owner, ice-element D1–D6): the mirror of fire on the terrain field. The cold is
 * an arrival time per sample on the same kind of front as fire, but the front has its own clock
 * (`fedSeconds`) that only runs while a freeze ray feeds it. Which samples are frozen right now
 * is the arena's `frozen` flag; this state holds how they got there and when they thaw. Sample
 * indices are the arena grid's (`cy * widthCells + cx`).
 */
export interface IceState {
  /** The cold front: arrival times on the feed clock, and the pending arrivals. */
  front: SampleFront;
  /** The feed clock: seconds freeze rays have fed the front so far. */
  fedSeconds: number;
  /** Sim time of the last step a ray touched terrain (the front moves only on such steps). */
  fedAt: number;
  /** Sim seconds each frozen sample thaws by itself; 0 = not frozen by this state. */
  thawAt: Float32Array;
  /** Frozen samples in freezing order (constant frozen time ⇒ also thaw order). */
  frozen: number[];
  /** The thaw time each `frozen` entry was given (an entry is stale when `thawAt` differs). */
  frozenDue: number[];
  /** First entry of `frozen` not yet thawed. */
  frozenHead: number;
  /** The terrain's `frozenVersion` after this state's own last write (others' thaws show as a gap). */
  frozenSeen: number;
  /** The freeze rays of the last step, for the renderer. */
  rays: FreezeRayBeam[];
}

/** One freeze ray this step: the helmet it comes from and where each of its rays ended. */
export interface FreezeRayBeam {
  slot: number;
  origin: Vec2;
  /** End of each ray (first terrain met, or full length). */
  ends: Vec2[];
  /** Whether each ray ended on terrain. */
  touched: boolean[];
  /** Sim time of the step it was held in. */
  atSeconds: number;
}
