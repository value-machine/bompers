import type { Vec2 } from "@/shared/types/gameGeometry.types";

/**
 * A spray's stream of puffs (owner, freeze-ray-spray D1, "Frost jet"): puffs that travel out
 * along each ray of a spray's fan (`castRayFan`) to that ray's own end, growing as they go, so
 * the drawn spray fills exactly what the rays reached. Pure and deterministic (no RNG in
 * render): where a puff is depends only on the time and the rays. Used by the freeze ray;
 * the torch draws its own flame (`flameShapes`).
 */
export interface SprayStreamLook {
  /** Puffs on each ray at any time. */
  perRay: number;
  /** How fast a puff travels, world units per second. */
  speed: number;
  /** Where puffs start along each ray, world units from the origin. */
  startAt: number;
  /** Radius at the start, and what it adds by the ray's end. */
  radius: number;
  grow: number;
  /** Sideways wobble by the ray's end, and how far a puff rises by then, world units. */
  wobble: number;
  rise: number;
}

/** One puff: its centre, radius and how far it is along its ray (0 start … 1 end). */
export interface StreamPuff {
  x: number;
  y: number;
  r: number;
  along: number;
}

/** Deterministic 0..1 noise. */
const noise = (seed: number): number => {
  const v = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};

/**
 * The puffs of a spray this frame: `perRay` on each ray from `origin` to its end, spread
 * evenly in time and staggered per ray. A ray shorter than `startAt` (a wall at the nozzle)
 * carries none.
 */
export function sprayStream(
  spray: { origin: Vec2; ends: readonly Vec2[] },
  at: { timeSeconds: number; look: SprayStreamLook }
): StreamPuff[] {
  const { origin } = spray;
  const { look, timeSeconds: t } = at;
  return spray.ends.flatMap((end, i) => {
    const dx = end.x - origin.x;
    const dy = end.y - origin.y;
    const length = Math.hypot(dx, dy);
    const run = length - look.startAt;
    if (run <= 0) return [];
    const ux = dx / length;
    const uy = dy / length;
    return Array.from({ length: look.perRay }, (_, k) => {
      const along = (t * (look.speed / run) + k / look.perRay + noise(i * 9 + k)) % 1;
      const d = look.startAt + run * along;
      const side = Math.sin(t * 6 + i * 2 + k * 3) * look.wobble * along;
      return {
        x: origin.x + ux * d - uy * side,
        y: origin.y + uy * d + ux * side - look.rise * along * along,
        r: look.radius + look.grow * along,
        along,
      };
    });
  });
}
