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
  /** Blobs on fire, by player id (fire-burn b2). */
  blobs: Map<string, BurningBlob>;
  /** Sim time until which a blob just put out can't catch again, by player id. */
  blobGraceUntil: Map<string, number>;
  /** Recent burning-blob moments, for the effects (pruned after `fire.blob.momentSeconds`). */
  blobMoments: BlobFireMoment[];
  /** Times each player caught fire / was put out by ice (monotonic, for sound cues). */
  caughtCounts: Record<string, number>;
  dousedCounts: Record<string, number>;
}

/** A blob on fire (fire-burn b2): when it caught, where the fire came from, who lit it. */
export interface BurningBlob {
  slot: number;
  /** Sim time it caught; it burns `fire.blob.burnSeconds` from here. */
  since: number;
  /** World x the fire came from: with no move input the blob runs the other way (D2). */
  fromX: number;
  /** Who lit or passed the fire (credit for the chunk); null = terrain fire nobody lit. */
  bySlot: number | null;
  /** Damage ticks dealt so far (the first comes mid-burn, owner fire-burn D10). */
  ticks: number;
}

/**
 * A moment of a burning blob, kept briefly for the effects: caught, put out by ice (`steam`),
 * flames blown off by a dive (`blown`), passed to a rival by a bump (`leap`, to `to`), or burnt
 * down to the chunk loss (`smoke`).
 */
export interface BlobFireMoment {
  kind: "caught" | "steam" | "blown" | "leap" | "smoke";
  slot: number;
  at: Vec2;
  /** Where the fire leapt to (`leap` only). */
  to?: Vec2;
  atSeconds: number;
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
