import type { Vec2 } from "@/shared/types/gameGeometry.types";
import type { SampleFront } from "@/shared/types/sampleFront.types";
import type { SprayParticleStream } from "@/shared/types/sprayParticles.types";

/**
 * Frozen ground (owner, ice-element D1–D8): the cold flows out from where a freeze ray touches
 * the ground. Which samples are frozen right now is the arena's `frozen` flag; this state holds
 * each ray's feed and when each frozen sample thaws, per body of the arena (mover-materials
 * lap 2b): the static terrain and each moving part's own field.
 */
export interface IceState {
  /** One feed per freeze ray and body it touches (`feedKey`). */
  feeds: Map<number, ColdFeed>;
  /**
   * The thaw queue of every body, in the arena's body order (`bodyGrids`): 0 = the static
   * terrain, then each moving part's own field.
   */
  grounds: GroundIce[];
  /** Every freeze ray's puffs in flight, held or let go (freeze-ray-particles D1). */
  sprays: FreezeSpray[];
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

/** When one body's frozen samples thaw. Sample indices are that body's grid's. */
export interface GroundIce {
  /** Sim seconds each frozen sample thaws by itself; 0 = not frozen by this state. */
  thawAt: Float32Array;
  /** Frozen samples in freezing order (constant frozen time ⇒ also thaw order). */
  frozen: number[];
  /** The thaw time each `frozen` entry was given (an entry is stale when `thawAt` differs). */
  frozenDue: number[];
  /** First entry of `frozen` not yet thawed. */
  frozenHead: number;
  /** Queue entries passed so far (only goes up; the thaw sound reads it). */
  thawed: number;
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
  /** Ice not yet placed, in samples (fractions carry over to the next step). */
  budget: number;
  /** Sim time of the last step the beam touched ground. */
  fedAt: number;
}

/**
 * One holder's freeze-ray puffs (owner, freeze-ray-particles D1, "Cold travels"): they keep
 * flying after the ray is let go, until each lands or runs out of reach.
 */
export interface FreezeSpray {
  slot: number;
  stream: SprayParticleStream;
  /** Whether the ray was held this step (the loop sound, the spray start). */
  held: boolean;
  /** Sim time of the last step it was held. */
  heldAt: number;
  /** How far its puffs may fly this step (shorter in a beam clash). */
  reach: number;
}
