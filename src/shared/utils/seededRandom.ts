/**
 * Seeded randomness for content built from parameters (level objects): the same seed gives the
 * same sequence on every machine, so a level file always looks the same. Not for gameplay rolls.
 */

/** A uniform generator in [0, 1) for a 32-bit seed (mulberry32). */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A 32-bit seed from text (FNV-1a), e.g. a level id plus an ordinal. */
export function hashSeed(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** A number in [min, max) from a generator. */
export const randomBetween = (random: () => number, min: number, max: number): number =>
  min + (max - min) * random();
