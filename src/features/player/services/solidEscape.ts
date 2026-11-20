import type { Vec2 } from "@/shared/types/gameGeometry.types";
import { nearestFreeOffset } from "@/shared/utils/freeSpotSearch";
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
 * crush rule takes it (match). The ring search itself is the shared `nearestFreeOffset`
 * (`src/shared/utils/freeSpotSearch.ts`), which physics objects use too.
 */

export type EscapeResult = "free" | "moved" | "squeezed" | "trapped";

/** Nearest free position at the body's current size, within a body width; false = none. */
function escapeAtSize(player: PlayerState, terrain: TerrainGrid): boolean {
  const from = { x: player.x, y: player.y };
  const normal = fieldNormalAt(terrain, { x: player.x, y: player.y - player.height / 2 });
  const hitsAt = (offset: Vec2): boolean => {
    player.x = from.x + offset.x;
    player.y = from.y + offset.y;
    return bodyHitsSolid(player, terrain);
  };
  const found = nearestFreeOffset({
    hitsAt,
    startAngle: Math.atan2(normal.y, normal.x),
    maxReach: player.width,
  });
  player.x = from.x + (found?.x ?? 0);
  player.y = from.y + (found?.y ?? 0);
  return found !== null;
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
