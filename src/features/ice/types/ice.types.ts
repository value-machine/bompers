import type { Vec2 } from "@/shared/types/gameGeometry.types";
import type { SampleFront } from "@/shared/types/sampleFront.types";

/**
 * Frozen ground (owner, ice-element D1–D8): the cold flows out from where a freeze ray touches
 * the ground. Which samples are frozen right now is the arena's `frozen` flag; this state holds
 * each ray's feed and when each frozen sample thaws. Sample indices are the arena grid's
 * (`cy * widthCells + cx`).
 */
export interface IceState {
  /** One feed per player slot holding a freeze ray. */
  feeds: Map<number, ColdFeed>;
  /** Sim seconds each frozen sample thaws by itself; 0 = not frozen by this state. */
  thawAt: Float32Array;
  /** Frozen samples in freezing order (constant frozen time ⇒ also thaw order). */
  frozen: number[];
  /** The thaw time each `frozen` entry was given (an entry is stale when `thawAt` differs). */
  frozenDue: number[];
  /** First entry of `frozen` not yet thawed. */
  frozenHead: number;
  /** The freeze rays of the last step, for the renderer. */
  rays: FreezeRayBeam[];
  /** Blobs gathering chill or frozen in a block, by player id (ice-frozen-blobs D1, D3). */
  blobs: Map<string, IceBlob>;
  /** Sim time until which a blob whose block just ended gathers no chill, by player id. */
  blobGraceUntil: Map<string, number>;
  /** Recent frozen-blob moments, for the renderer (pruned after `ice.blob.momentSeconds`). */
  blobMoments: IceBlobMoment[];
  /** Times frozen, cracks made and blocks broken per player id (monotonic; sound). */
  frozeCounts: Record<string, number>;
  crackCounts: Record<string, number>;
  shatterCounts: Record<string, number>;
}

/** One blob's ice: chill building up in a freeze ray, or the block it is frozen in. */
export interface IceBlob {
  slot: number;
  /** Seconds of beam gathered (crouching counts half); frozen at `ice.blob.freezeSeconds`. */
  chill: number;
  /** Sim time of the last step a ray reached it (chill runs back down otherwise). */
  chilledAt: number;
  /** Sim time it froze, or null while only chilled. */
  frozenAt: number | null;
  /** Jump presses made in the block so far, and when the last one was (the drawn hop). */
  cracks: number;
  crackedAt: number;
  /** Jump was held last step (a press is a rising edge; held at the freeze is no press). */
  jumpHeld: boolean;
}

/**
 * A frozen-blob moment: it froze, a jump press cracked the block, the block broke (third press,
 * a hit, time up) or fire melted it.
 */
export interface IceBlobMoment {
  kind: "frozen" | "crack" | "shatter" | "melt";
  slot: number;
  at: Vec2;
  atSeconds: number;
}

/**
 * One ray's cold: a front of path distances through the ground from where the beam touches
 * (nearest first), and the ice it may still make.
 */
export interface ColdFeed {
  /** Distance through solid ground from the touched samples; restarted when the beam moves. */
  front: SampleFront;
  /** Which samples the front was started from (the lowest touched index). */
  seedKey: number;
  /** Ice not yet placed, in samples (fractions carry over to the next step). */
  budget: number;
  /** Sim time of the last step the beam touched ground. */
  fedAt: number;
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
