/**
 * The fly-off of health pieces (hurt-feedback D1; owner, death-health-bar D1): pieces pop up and
 * out in a fan, fall with gravity and spin, and fade over the last third of their time. Shared by
 * the hurt chunks a hit throws off (`effects`) and the empty over-head hearts scattering on a
 * knockout (`combat`), so both fly the same way.
 */
export const FLY_OFF = {
  /** Launch speed, world units / s. */
  speed: 220,
  /** Fall, world units / s². */
  gravity: 1100,
  /** Spin, rad / s at the largest. */
  spin: 7,
  /** Fan angle between neighbouring pieces, rad. */
  spread: 0.7,
} as const;

/** A repeatable 0..1 value per seed and index (no randomness in the renderer's output). */
export const hashNoise = (seed: number, i: number): number => {
  const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export interface FlyOffPiece {
  /** This piece's place in the fan, 0 … count − 1. */
  index: number;
  count: number;
  /** Seconds since the pieces left. */
  age: number;
  /** Seeds the small per-piece jitter in angle and spin. */
  seed: number;
}

/** Offset (world units) and rotation of one piece `age` seconds into its flight. */
export function flyOffPose(piece: FlyOffPiece): { x: number; y: number; rotation: number } {
  const { index: i, age, seed } = piece;
  const middle = (piece.count - 1) / 2;
  const angle = -Math.PI / 2 + (i - middle) * FLY_OFF.spread + (hashNoise(seed, i) - 0.5) * 0.6;
  return {
    x: Math.cos(angle) * FLY_OFF.speed * age,
    y: Math.sin(angle) * FLY_OFF.speed * age + 0.5 * FLY_OFF.gravity * age * age,
    rotation: (hashNoise(seed, i + 7) - 0.5) * FLY_OFF.spin * age * 2,
  };
}

/** Full alpha, then a fade over the last third of `seconds`. */
export const flyOffAlpha = (age: number, seconds: number): number =>
  Math.max(0, Math.min(1, 3 * (1 - age / seconds)));
