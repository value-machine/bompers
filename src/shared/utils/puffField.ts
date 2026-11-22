import { traceRings, type OutlineRing } from "@/shared/utils/contourRings";

/**
 * A puff field (owner, freeze-ray-shape D1, "Cloud shape"): round puffs that melt into one shape.
 * Each puff adds a smooth bump to a coarse grid, (1 − d² / R²)² inside R = `reach` × its radius
 * and zero outside, and the shape is where the sum reaches a level. Its edge comes from the
 * shared `traceRings`, so a spray of many puffs draws as a few rings with one outline instead of
 * many overlapping circles. Splatting each puff into its own neighbourhood keeps the cost to the
 * puffs' area, not the grid's.
 */
export interface Puff {
  x: number;
  y: number;
  r: number;
}

export interface PuffFieldLook {
  /** Grid spacing, world units. */
  cell: number;
  /** A puff's bump reaches this many radii. */
  reach: number;
}

interface Grid {
  x0: number;
  y0: number;
  nx: number;
  ny: number;
  v: Float32Array;
}

function splat(puffs: readonly Puff[], look: PuffFieldLook): Grid | null {
  if (puffs.length === 0) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of puffs) {
    const R = p.r * look.reach;
    x0 = Math.min(x0, p.x - R);
    y0 = Math.min(y0, p.y - R);
    x1 = Math.max(x1, p.x + R);
    y1 = Math.max(y1, p.y + R);
  }
  // One empty cell all round, so every ring closes inside the grid.
  x0 -= look.cell;
  y0 -= look.cell;
  const nx = Math.ceil((x1 - x0) / look.cell) + 2;
  const ny = Math.ceil((y1 - y0) / look.cell) + 2;
  const v = new Float32Array(nx * ny);
  for (const p of puffs) addPuff({ x0, y0, nx, ny, v }, p, look);
  return { x0, y0, nx, ny, v };
}

function addPuff(grid: Grid, p: Puff, look: PuffFieldLook): void {
  const R = p.r * look.reach;
  if (R <= 0) return;
  const R2 = R * R;
  const { x0, y0, nx, ny, v } = grid;
  const ax = Math.max(0, Math.floor((p.x - R - x0) / look.cell));
  const bx = Math.min(nx - 1, Math.ceil((p.x + R - x0) / look.cell));
  const ay = Math.max(0, Math.floor((p.y - R - y0) / look.cell));
  const by = Math.min(ny - 1, Math.ceil((p.y + R - y0) / look.cell));
  for (let j = ay; j <= by; j += 1) {
    const dy = y0 + j * look.cell - p.y;
    for (let i = ax; i <= bx; i += 1) {
      const dx = x0 + i * look.cell - p.x;
      const q = 1 - (dx * dx + dy * dy) / R2;
      if (q > 0) v[j * nx + i] = (v[j * nx + i] ?? 0) + q * q;
    }
  }
}

/** The edge of the puffs' merged shape at each level (higher levels sit further inside). */
export function puffFieldRings(
  puffs: readonly Puff[],
  opts: { look: PuffFieldLook; levels: readonly number[] }
): OutlineRing[][] {
  const grid = splat(puffs, opts.look);
  if (!grid) return opts.levels.map(() => []);
  const { x0, y0, nx, ny, v } = grid;
  const cell = opts.look.cell;
  // One reused set of corners: the tracer reads a cell's corners only while it handles that cell.
  const quad = [0, 1, 2, 3].map(() => ({ x: 0, y: 0, v: 0 }));
  const set = (k: number, at: { i: number; j: number; level: number }): void => {
    const c = quad[k]!;
    c.x = x0 + at.i * cell;
    c.y = y0 + at.j * cell;
    c.v = (v[at.j * nx + at.i] ?? 0) - at.level;
  };
  return opts.levels.map((level) =>
    traceRings({
      minX: 0,
      minY: 0,
      maxX: nx - 2,
      maxY: ny - 2,
      corners: (i, j) => {
        set(0, { i, j, level });
        set(1, { i: i + 1, j, level });
        set(2, { i: i + 1, j: j + 1, level });
        set(3, { i, j: j + 1, level });
        return quad;
      },
    })
  );
}
