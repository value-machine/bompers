import type { Vec2 } from "@/shared/types/gameGeometry.types";

/**
 * Respawn point choice (GDD § 6): of the level's predefined safe spawns, the one whose nearest
 * active opponent is farthest away. Ties go to the lowest index, so the choice is
 * deterministic. With no opponent in play, the player's own slot spawn is used.
 */
export interface ChooseSpawnArgs {
  spawns: readonly Vec2[];
  /** Feet points of the opponents currently in play. */
  opponents: readonly Vec2[];
  /** Used when there is no opponent to keep away from. */
  slot: number;
}

const nearestDistance = (point: Vec2, others: readonly Vec2[]): number =>
  Math.min(...others.map((other) => Math.hypot(other.x - point.x, other.y - point.y)));

/** Index into `spawns` of the chosen point (-1 only when there are no spawns). */
export function chooseSpawnIndex({ spawns, opponents, slot }: ChooseSpawnArgs): number {
  if (spawns.length === 0) return -1;
  if (opponents.length === 0) return slot % spawns.length;
  let best = 0;
  let bestDistance = -1;
  spawns.forEach((spawn, index) => {
    const distance = nearestDistance(spawn, opponents);
    if (distance > bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}
