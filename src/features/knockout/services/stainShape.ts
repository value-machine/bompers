import type { TerrainGrid } from "@/features/arena/api/arenaApi";
import type { GooSplat } from "@/features/knockout/types/knockout.types";

/**
 * A goo stain (owner, terrain-stains D1: "the same shape as ice"): where goo lands it colours a
 * thin coat of the object itself, the samples just under its surface around the touch point.
 * The renderer draws those samples with the terrain's own contour, so the stain has the object's
 * shape, like frozen ground. Each stain's size is seeded by its key (owner, elimination-goo
 * Change round: "not the same stain every time"), so it keeps its size every frame and the same
 * event always stains the same way.
 * - On a wall the goo runs down along the surface for a moment.
 * - After the respawn it dries up: it shrinks toward where it landed until it is gone.
 */
export const STAIN_LOOK = {
  /** Overall size range of a stain, × its droplet's radius. */
  size: { min: 1.3, max: 1.8 },
  /** How far along the surface a stain reaches from its touch point, × size × radius. */
  reach: 2.2,
  /** How deep under the surface the coat goes, in samples. */
  depthSamples: 1.6,
  /** A wall stain's run: its length (× size × radius, varied), half-width and depth in samples. */
  run: 4,
  runVary: { min: 0.7, max: 1.3 },
  runHalfWidthSamples: 1.75,
  runDepthSamples: 1.1,
  /** Seconds a run takes to reach its full length. */
  runSeconds: 0.5,
  /** How much of its reach and depth a stain has lost when it is fully dry. */
  dryReach: 0.75,
  dryDepth: 0.5,
} as const;

/** One stain's seeded size, world units. */
export interface StainShape {
  /** Reach along the surface from the touch point. */
  reach: number;
  /** Full length of the run down a wall (0 on floors, ceilings and moving parts). */
  run: number;
}

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

/** The stain's size for its surface, seeded by its key. Only a stain on a standing wall runs. */
export function stainShape(splat: Pick<GooSplat, "key" | "ny" | "radius" | "rides">): StainShape {
  const random = seededRandom(hashKey(splat.key));
  const { size, runVary } = STAIN_LOOK;
  const scale = (size.min + (size.max - size.min) * random()) * splat.radius;
  const vary = runVary.min + (runVary.max - runVary.min) * random();
  const onWall = splat.ny === 0 && !splat.rides;
  return { reach: STAIN_LOOK.reach * scale, run: onWall ? STAIN_LOOK.run * scale * vary : 0 };
}

export interface StainTiming {
  respawnDelaySeconds: number;
  /** A stain is gone at this age. */
  splatSeconds: number;
}

/** How dry a stain is, 0 → 1: wet until the respawn, then drying until it is gone. */
export function stainDryness(age: number, timing: StainTiming): number {
  const { respawnDelaySeconds, splatSeconds } = timing;
  if (age <= respawnDelaySeconds) return 0;
  return Math.min(1, (age - respawnDelaySeconds) / (splatSeconds - respawnDelaySeconds));
}

/**
 * What a stain looks like now: it changes while it runs and while it dries, and holds still in
 * between. The renderer redraws stains only when a stage changes.
 */
export function stainStage(age: number, timing: StainTiming): string {
  const step = 0.05;
  if (age < STAIN_LOOK.runSeconds) return `r${Math.floor(age / step)}`;
  if (age <= timing.respawnDelaySeconds) return "wet";
  return `d${Math.floor((age - timing.respawnDelaySeconds) / step)}`;
}

export interface StainAt {
  /** The touch point in the field's own coordinates (a moving part's: its rest pose). */
  x: number;
  y: number;
  age: number;
  timing: StainTiming;
}

type StainedSplat = Pick<GooSplat, "key" | "ny" | "radius" | "rides">;

/** A stain's extent now, world units: its reach and depth as dried, its run as far as it got. */
function stainExtent(field: TerrainGrid, splat: StainedSplat, at: StainAt) {
  const shape = stainShape(splat);
  const dry = stainDryness(at.age, at.timing);
  const reach = shape.reach * (1 - STAIN_LOOK.dryReach * dry);
  const run = shape.run * Math.min(1, at.age / STAIN_LOOK.runSeconds) * (1 - dry);
  return {
    reach,
    depth: STAIN_LOOK.depthSamples * field.cellSize * (1 - STAIN_LOOK.dryDepth * dry),
    run,
    runBottom: at.y + 0.6 * reach + run,
  };
}

/**
 * The samples of `field` a stain colours now: solid samples within the coat's depth of the
 * surface and within the stain's reach of its touch point, plus the run under a wall stain.
 */
export function stainSamples(field: TerrainGrid, splat: StainedSplat, at: StainAt): number[] {
  const size = field.cellSize;
  const { reach, depth, run, runBottom } = stainExtent(field, splat, at);
  const inRun = (x: number, y: number, distance: number): boolean =>
    run > 0 &&
    Math.abs(x - at.x) < STAIN_LOOK.runHalfWidthSamples * size &&
    y > at.y &&
    y < runBottom &&
    distance < STAIN_LOOK.runDepthSamples * size;
  const inStain = (cx: number, cy: number): boolean => {
    const distance = field.distance[cy * field.widthCells + cx] ?? 0;
    if (distance <= 0 || distance >= depth) return false;
    const x = (cx + 0.5) * size;
    const y = (cy + 0.5) * size;
    return Math.hypot(x - at.x, y - at.y) < reach || inRun(x, y, distance);
  };
  const samples: number[] = [];
  const maxX = Math.min(field.widthCells - 1, Math.floor((at.x + reach) / size));
  const maxY = Math.min(
    field.heightCells - 1,
    Math.floor(Math.max(at.y + reach, runBottom) / size)
  );
  for (let cy = Math.max(0, Math.floor((at.y - reach) / size)); cy <= maxY; cy += 1) {
    for (let cx = Math.max(0, Math.floor((at.x - reach) / size)); cx <= maxX; cx += 1) {
      if (inStain(cx, cy)) samples.push(cy * field.widthCells + cx);
    }
  }
  return samples;
}
