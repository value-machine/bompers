import type { Vec2 } from "@/shared/types/gameGeometry.types";

/** The spray particle stream's state and look (`src/shared/utils/sprayParticles.ts`). */
export interface SprayPuff {
  x: number;
  y: number;
  /** Unit heading, fixed at emission. */
  dx: number;
  dy: number;
  /** Distance flown so far. */
  travelled: number;
}

/** Where a puff stopped on a field: drawn as a burst for a moment. */
export interface SprayBurst {
  x: number;
  y: number;
  /** Sim time it landed. */
  at: number;
}

export interface SprayParticleStream {
  puffs: SprayPuff[];
  bursts: SprayBurst[];
  /** Puffs emitted so far (the spread sequence's index). */
  emitted: number;
  /** Fraction of a puff owed to the next step. */
  carry: number;
}

export interface SprayParticleLook {
  /** Puffs per second while held. */
  rate: number;
  /** Speed of every puff, world units per second. */
  speed: number;
  /** How far a puff flies at most. */
  length: number;
  /** Half the fan the puffs leave across, degrees. */
  halfAngleDegrees: number;
  /** Most puffs in flight per stream; the oldest go first. */
  cap: number;
  /** How long a burst is drawn. */
  burstSeconds: number;
}

/** One field sample a puff stopped on this step. */
export interface SprayTerrainHit {
  /** Which field (0 = the first). */
  body: number;
  sample: number;
}

export interface SprayStepHits<Body> {
  terrain: SprayTerrainHit[];
  /** Each body a puff passed through this step, with the sum of those puffs' headings. */
  bodies: Map<Body, Vec2>;
}
