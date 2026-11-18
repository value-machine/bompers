import type { Vec2 } from "@/shared/types/gameGeometry.types";

/**
 * The burning-blobs slice of the game state (fire-burn b2; its own feature since the blob-fire
 * split): which blobs burn, the grace after going out, the recent moments and the sound counters.
 */
export interface BlobFireState {
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
