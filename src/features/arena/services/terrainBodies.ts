import type { Vec2 } from "@/shared/types/gameGeometry.types";
import type { PosedField } from "@/shared/types/sampleFront.types";
import { posePoint } from "@/shared/utils/levelMotion";
import type { MoverBody, TerrainGrid } from "@/features/arena/types/arena.types";
import {
  clearCrater,
  fieldBand,
  partGridPoint,
  partLocalPoint,
  type ClearedCells,
  type ClearedLook,
  type Crater,
} from "@/features/arena/services/terrainGrid";

/**
 * The bodies of the arena (owner, mover-materials D1: one world of bodies): the static terrain
 * and every moving part, each with its own grid of samples. Element systems (beams, fire, cold,
 * blasts) act on this list, so a part of a material reacts like ground of that material. Body 0
 * is the static terrain; body `i` is `grid.movers[i - 1]`. The grid functions themselves
 * (`terrainGrid.ts`) work on one grid and do not know the list.
 */

/**
 * The fields a ray can meet, each placed in the world (mover-materials D4): the static terrain
 * first, then every moving part in its pose this step. A point beyond a part's reach is out of
 * its field.
 */
export function terrainBodies(grid: TerrainGrid): PosedField[] {
  const parts = grid.movers.map(
    (mover): PosedField => ({ field: mover.field, toLocal: (p) => partLocalPoint(mover, p) })
  );
  return [{ field: grid }, ...parts];
}

/**
 * Every body's own grid, in the order of `terrainBodies`: the static terrain, then each moving
 * part's field. State kept per body (fire, mover-materials-l2 D3) is indexed the same way.
 */
export const bodyGrids = (grid: TerrainGrid): TerrainGrid[] => [
  grid,
  ...grid.movers.map((mover) => mover.field),
];

/** One number that changes whenever a frozen flag changes on any body (sound, redraw keys). */
export const frozenVersionOf = (grid: TerrainGrid): number =>
  bodyGrids(grid).reduce((sum, body) => sum + body.frozenVersion, 0);

/** The world point of a point in body `body`'s own grid (the inverse of its `toLocal`). */
export function bodyWorldPoint(grid: TerrainGrid, body: number, local: Vec2): Vec2 {
  const mover = grid.movers[body - 1];
  if (!mover) return local;
  const rest = { x: local.x + mover.origin.x, y: local.y + mover.origin.y };
  return posePoint(mover.pose, mover.pivot, rest);
}

/** What a blast removed over all bodies: the looks pooled, for the debris and the sound. */
export type ClearedBodies = Pick<ClearedCells, "removed" | "byLook">;

/** Adds one body's removed samples to the pool, joining looks that are the same. */
export function poolCleared(pool: ClearedBodies, cleared: ClearedCells): void {
  pool.removed += cleared.removed;
  for (const look of cleared.byLook) {
    const same = pool.byLook.find(
      (known: ClearedLook) => known.materialId === look.materialId && known.colorId === look.colorId
    );
    if (same) same.cells += look.cells;
    else pool.byLook.push({ ...look });
  }
}

/**
 * The crater as one moving part sees it: its centre in the part's own grid in its pose this
 * step, or null when the part is out of the crater's reach. A crater shape is round today, so
 * only the centre moves; a shape with a direction would also turn with the part.
 */
function craterOnPart(mover: MoverBody, crater: Crater): Crater | null {
  // The widest a crater opens is its reach in the softest material; the part's reach covers its field.
  const softest = Math.min(
    ...mover.field.slots.map((slot) => slot.toughness ?? Infinity).filter((t) => t > 0)
  );
  if (!Number.isFinite(softest)) return null;
  const span = crater.reach / softest + fieldBand(mover.field);
  const dx = crater.x - mover.pivot.x - mover.pose.dx;
  const dy = crater.y - mover.pivot.y - mover.pose.dy;
  if (Math.hypot(dx, dy) > mover.reach + span) return null;
  // The centre may lie outside the part's reach while its rim still cuts the part.
  const centre = partGridPoint(mover, crater);
  return { ...crater, x: centre.x, y: centre.y };
}

/**
 * Blasts a crater out of every body it reaches (owner, mover-materials-l4 D1: blasts break
 * moving parts like terrain): the static terrain, and each moving part where it is this step.
 * Each body is cut by its own materials' toughness, so cardboard and earth parts crater and
 * stone and ice parts stay whole. Returns what was removed, pooled per material + colour.
 */
export function clearCraterOnBodies(grid: TerrainGrid, crater: Crater): ClearedBodies {
  const pool: ClearedBodies = { removed: 0, byLook: [] };
  poolCleared(pool, clearCrater(grid, crater));
  for (const mover of grid.movers) {
    const onPart = craterOnPart(mover, crater);
    if (onPart) poolCleared(pool, clearCrater(mover.field, onPart));
  }
  return pool;
}
