import type { Vec2 } from "@/shared/types/gameGeometry.types";

/**
 * The never-stuck search (owner, never-stuck; shared since the physics-objects lap): the nearest
 * offset at which a body no longer overlaps solid, searched on growing rings around where it is,
 * starting along a preferred direction (the terrain normal) and alternating to either side, then
 * brought back to contact by bisection. The caller says what "overlaps" means with `hitsAt`, so
 * blobs (round body + head box) and physics objects (circles) share one resolver.
 */

/** Ring spacing of the search (world units). */
const RING_STEP = 0.5;
/** Directions tried on each ring, starting along the preferred direction. */
const RING_DIRECTIONS = 16;
/** Halvings that bring the found offset back to contact. */
const CONTACT_HALVINGS = 10;

export interface FreeSpotSearch {
  /** The body moved by `offset` from where it is overlaps solid. */
  hitsAt: (offset: Vec2) => boolean;
  /** Angle (radians) of the first direction tried on each ring. */
  startAngle: number;
  /** Farthest ring searched, world units. */
  maxReach: number;
}

/** Free direction on the ring of radius `r` (preferred first, then alternating sides), or null. */
function freeDirection(search: FreeSpotSearch, r: number): Vec2 | null {
  for (let i = 0; i < RING_DIRECTIONS; i += 1) {
    // 0, +1, −1, +2, −2, … steps around from the preferred direction.
    const k = i % 2 === 0 ? i / 2 : -(i + 1) / 2;
    const angle = search.startAngle + (k * 2 * Math.PI) / RING_DIRECTIONS;
    const dir = { x: Math.cos(angle), y: Math.sin(angle) };
    if (!search.hitsAt({ x: dir.x * r, y: dir.y * r })) return dir;
  }
  return null;
}

/** Back along `dir` from the free radius `r` to contact (bisection); the result is free. */
function backToContact(search: FreeSpotSearch, dir: Vec2, r: number): Vec2 {
  let hit = 0;
  let free = r;
  for (let i = 0; i < CONTACT_HALVINGS; i += 1) {
    const mid = (hit + free) / 2;
    if (search.hitsAt({ x: dir.x * mid, y: dir.y * mid })) hit = mid;
    else free = mid;
  }
  return { x: dir.x * free, y: dir.y * free };
}

/** Nearest free offset within `maxReach`, at contact; `{0,0}` when already free; null = none. */
export function nearestFreeOffset(search: FreeSpotSearch): Vec2 | null {
  if (!search.hitsAt({ x: 0, y: 0 })) return { x: 0, y: 0 };
  for (let r = RING_STEP; r <= search.maxReach + 1e-9; r += RING_STEP) {
    const dir = freeDirection(search, r);
    if (dir) return backToContact(search, dir, r);
  }
  return null;
}
