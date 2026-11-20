import type { Vec2 } from "@/shared/types/gameGeometry.types";
import { fieldNormalAt, type TerrainGrid } from "@/features/arena/api/arenaApi";
import { bodyHitsSolid } from "@/features/player/services/playerController";
import type { PlayerState } from "@/features/player/types/player.types";

/**
 * The never-stuck invariant (owner, never-stuck): a blob never starts its own step overlapping
 * terrain or a moving part. The controller's contact moves (`moveAxis`) keep a free body free but
 * cannot move a body that already overlaps (every sub-step hits, so it backs off to where it
 * was): a blob a moving part left inside solid would be frozen there. `escapeSolid` moves such a
 * body to the nearest free position; where none is within a body width it shrinks to fit, as a
 * moving part's squeeze does, and when even the lethal size fits nowhere it is trapped and the
 * crush rule takes it (match).
 */

/** Ring spacing of the search (world units). */
const RING_STEP = 0.5;
/** Directions tried on each ring, starting along the terrain normal. */
const RING_DIRECTIONS = 16;
/** Halvings that bring the found position back to contact. */
const CONTACT_HALVINGS = 10;

export type EscapeResult = "free" | "moved" | "squeezed" | "trapped";

/** The body at `offset` from `from` hits solid (the body is left there). */
function hitsAt(player: PlayerState, step: { from: Vec2; offset: Vec2; terrain: TerrainGrid }) {
  player.x = step.from.x + step.offset.x;
  player.y = step.from.y + step.offset.y;
  return bodyHitsSolid(player, step.terrain);
}

/** Free direction on the ring of radius `r` (normal first, then alternating sides), or null. */
function freeDirection(
  player: PlayerState,
  ring: { from: Vec2; r: number; start: number; terrain: TerrainGrid }
): Vec2 | null {
  for (let i = 0; i < RING_DIRECTIONS; i += 1) {
    // 0, +1, −1, +2, −2, … steps around from the normal.
    const k = i % 2 === 0 ? i / 2 : -(i + 1) / 2;
    const angle = ring.start + (k * 2 * Math.PI) / RING_DIRECTIONS;
    const dir = { x: Math.cos(angle), y: Math.sin(angle) };
    const offset = { x: dir.x * ring.r, y: dir.y * ring.r };
    if (!hitsAt(player, { from: ring.from, offset, terrain: ring.terrain })) return dir;
  }
  return null;
}

/** Back along `dir` from the free radius `r` to contact (bisection); leaves the body free. */
function settleToContact(
  player: PlayerState,
  step: { from: Vec2; dir: Vec2; r: number; terrain: TerrainGrid }
): void {
  let hit = 0;
  let free = step.r;
  for (let i = 0; i < CONTACT_HALVINGS; i += 1) {
    const mid = (hit + free) / 2;
    const offset = { x: step.dir.x * mid, y: step.dir.y * mid };
    if (hitsAt(player, { from: step.from, offset, terrain: step.terrain })) hit = mid;
    else free = mid;
  }
  player.x = step.from.x + step.dir.x * free;
  player.y = step.from.y + step.dir.y * free;
}

/** Nearest free position at the body's current size, within a body width; false = none. */
function escapeAtSize(player: PlayerState, terrain: TerrainGrid): boolean {
  const from = { x: player.x, y: player.y };
  const normal = fieldNormalAt(terrain, { x: player.x, y: player.y - player.height / 2 });
  const start = Math.atan2(normal.y, normal.x);
  for (let r = RING_STEP; r <= player.width + 1e-9; r += RING_STEP) {
    const dir = freeDirection(player, { from, r, start, terrain });
    if (!dir) continue;
    settleToContact(player, { from, dir, r, terrain });
    return true;
  }
  player.x = from.x;
  player.y = from.y;
  return false;
}

/** Scale steps tried when the full-size body fits nowhere (largest first). */
const SQUEEZE_STEP = 0.05;

/**
 * Moves a body that overlaps solid to the nearest free position within a body width ("moved").
 * Where it fits nowhere at full size, it is squeezed like a moving part squeezes it, at the
 * largest scale down to `minScale` that fits ("squeezed": `player.squeeze` is set for this step);
 * below that it is trapped and left where it was (the crush rule).
 */
export function escapeSolid(
  player: PlayerState,
  terrain: TerrainGrid,
  limits: { minScale: number }
): EscapeResult {
  if (!bodyHitsSolid(player, terrain)) return "free";
  if (escapeAtSize(player, terrain)) return "moved";
  const kept = player.squeeze;
  const normal = fieldNormalAt(terrain, { x: player.x, y: player.y - player.height / 2 });
  const fullScale = kept?.scale ?? 1;
  for (let scale = fullScale - SQUEEZE_STEP; scale >= limits.minScale; scale -= SQUEEZE_STEP) {
    player.squeeze = { scale, nx: normal.x, ny: normal.y };
    if (!bodyHitsSolid(player, terrain) || escapeAtSize(player, terrain)) return "squeezed";
  }
  player.squeeze = kept;
  return "trapped";
}
