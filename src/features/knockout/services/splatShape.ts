import type { GooSplat } from "@/features/knockout/types/knockout.types";

/**
 * The look of one goo splat, varied per splat (owner, elimination-goo Change round: "bigger, more
 * unpredictable, not the same stain every time"). Seeded by the splat's key, so a splat keeps its
 * shape every frame and the same event always splats the same way; drawn once when it appears.
 * Units are world units around the touch point; the surface normal picks the layout:
 * - floor: a wide flat lens with 2–5 bulging lobes and 1–3 satellite dots;
 * - wall: a tall smear with 1–3 lobes and a streak that runs down (its length varies);
 * - ceiling: a hanging drip, with up to two smaller drips beside it.
 */
export interface SplatBlob {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

/** A drip hanging down from the surface: centre x, half-width, length. */
export interface SplatDrip {
  x: number;
  halfWidth: number;
  length: number;
}

export interface SplatShape {
  blobs: SplatBlob[];
  drips: SplatDrip[];
  /** Length of a wall splat's running streak (0 on floors and ceilings). */
  streak: number;
}

/** Overall size range of a splat, × the droplet radius scale of the old fixed look. */
export const SPLAT_SIZE = { min: 1.3, max: 1.8 } as const;

/** FNV-1a hash of the key: the seed. */
function hashKey(key: string): number {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Deterministic 0..1 values for one seed (mulberry32). */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Random = () => number;
const between = (random: Random, min: number, max: number): number => min + (max - min) * random();
const count = (random: Random, min: number, max: number): number =>
  min + Math.floor(random() * (max - min + 1));

function floorShape(r: number, size: number, random: Random): SplatShape {
  const rx = 2.3 * size * r;
  const ry = 0.55 * size * r * between(random, 0.8, 1.2);
  const blobs: SplatBlob[] = [{ x: 0, y: 0, rx, ry }];
  for (let i = count(random, 2, 5); i > 0; i -= 1) {
    const lobe = between(random, 0.35, 0.7) * size * r;
    blobs.push({
      x: between(random, -0.8, 0.8) * rx,
      y: between(random, -0.1, 0.3) * r,
      rx: lobe,
      ry: lobe * 0.8,
    });
  }
  for (let i = count(random, 1, 3); i > 0; i -= 1) {
    const side = random() < 0.5 ? -1 : 1;
    const dot = between(random, 0.15, 0.3) * r;
    blobs.push({ x: side * (rx + between(random, 0.3, 1.2) * r), y: 0.1 * r, rx: dot, ry: dot });
  }
  return { blobs, drips: [], streak: 0 };
}

function wallShape(r: number, size: number, random: Random): SplatShape {
  const rx = 0.6 * size * r;
  const ry = 1.6 * size * r * between(random, 0.8, 1.25);
  const blobs: SplatBlob[] = [{ x: 0, y: 0, rx, ry }];
  for (let i = count(random, 1, 3); i > 0; i -= 1) {
    const lobe = between(random, 0.3, 0.55) * size * r;
    blobs.push({ x: 0, y: between(random, -0.8, 0.8) * ry, rx: lobe, ry: lobe });
  }
  return { blobs, drips: [], streak: 4 * size * r * between(random, 0.7, 1.3) };
}

function ceilingShape(r: number, size: number, random: Random): SplatShape {
  const drips: SplatDrip[] = [
    { x: 0, halfWidth: 0.7 * size * r, length: 2 * size * r * between(random, 0.8, 1.3) },
  ];
  for (let i = count(random, 0, 2); i > 0; i -= 1) {
    const side = random() < 0.5 ? -1 : 1;
    drips.push({
      x: side * between(random, 0.9, 1.6) * size * r,
      halfWidth: between(random, 0.25, 0.4) * size * r,
      length: between(random, 0.6, 1.2) * size * r,
    });
  }
  return { blobs: [], drips, streak: 0 };
}

/** The splat's shape for its surface, seeded by its key. */
export function splatShape(splat: Pick<GooSplat, "key" | "nx" | "ny" | "radius">): SplatShape {
  const random = seededRandom(hashKey(splat.key));
  const size = between(random, SPLAT_SIZE.min, SPLAT_SIZE.max);
  if (splat.ny < 0) return floorShape(splat.radius, size, random);
  if (splat.ny > 0) return ceilingShape(splat.radius, size, random);
  return wallShape(splat.radius, size, random);
}
