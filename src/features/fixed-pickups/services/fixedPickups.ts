import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { Rect } from "@/shared/types/gameGeometry.types";
import { firstToucher } from "@/features/collectibles/api/collectiblesApi";
import type { LevelCollectible } from "@/features/level/api/levelApi";
import type { PlayerState } from "@/features/player/api/playerApi";
import type {
  FixedPickup,
  FixedPickupItem,
  FixedPickupTaken,
} from "@/features/fixed-pickups/types/fixedPickups.types";

/**
 * Fixed pickups (headbutt reset: FEEDBACK_ROUND_2 § 2.3, Celeste's dash-refill crystal; health:
 * health-pickups lap): one pickup on each collectible point whose item is a fixed pickup, present
 * from the match start. The first player allowed to take it who touches it takes it; it is then
 * gone for its item's `respawnSeconds` and comes back on its point. Who may take one (a spent
 * dive, missing health) is the match's call, so this feature knows nothing about dives or health.
 * Pure TS, no randomness or clock.
 */
export const DIVE_REFILL_ITEM = "dive-reset";
export const HEALTH_PICKUP_ITEM = "health";

const FIXED_PICKUP_ITEMS: readonly string[] = [DIVE_REFILL_ITEM, HEALTH_PICKUP_ITEM];

const isFixedPickupItem = (itemId: string): itemId is FixedPickupItem =>
  FIXED_PICKUP_ITEMS.includes(itemId);

/** Touch box and respawn time of one item (`collectibles.diveRefill` / `collectibles.health`). */
export const fixedPickupRule = (
  tunables: GameTunables,
  itemId: FixedPickupItem
): { respawnSeconds: number; size: number } =>
  itemId === HEALTH_PICKUP_ITEM ? tunables.collectibles.health : tunables.collectibles.diveRefill;

export function createFixedPickups(points: readonly LevelCollectible[]): FixedPickup[] {
  return points.flatMap((point, pointIndex) =>
    isFixedPickupItem(point.itemId)
      ? [
          {
            itemId: point.itemId,
            pointIndex,
            x: point.at.x,
            y: point.at.y,
            respawnTimer: 0,
            presentSeconds: 0,
          },
        ]
      : []
  );
}

export interface StepFixedPickupsArgs {
  pickups: FixedPickup[];
  /** Players in play. */
  players: readonly PlayerState[];
  /** Whether a player may take this item now (dive spent, health missing). */
  canTake: (itemId: FixedPickupItem, player: PlayerState) => boolean;
  tunables: GameTunables;
  dt: number;
}

export const fixedPickupBox = (pickup: FixedPickup, size: number): Rect => ({
  x: pickup.x - size / 2,
  y: pickup.y - size / 2,
  w: size,
  h: size,
});

/** Counts the respawn down; true while the pickup is still gone after this step. */
function tickRespawn(pickup: FixedPickup, dt: number): boolean {
  if (pickup.respawnTimer <= 0) return false;
  const left = pickup.respawnTimer - dt;
  // Float drift must not cost a whole extra step.
  pickup.respawnTimer = left > 1e-9 ? left : 0;
  pickup.presentSeconds = 0;
  return true;
}

/**
 * Counts respawns down and hands present pickups to the first allowed player touching them. A
 * player takes at most one of each item per step: one dive charge, one heal.
 */
export function stepFixedPickups(args: StepFixedPickupsArgs): FixedPickupTaken[] {
  const taken: FixedPickupTaken[] = [];
  for (const pickup of args.pickups) {
    if (tickRespawn(pickup, args.dt)) continue;
    pickup.presentSeconds += args.dt;
    const rule = fixedPickupRule(args.tunables, pickup.itemId);
    const candidates = args.players.filter(
      (player) =>
        args.canTake(pickup.itemId, player) &&
        !taken.some((t) => t.itemId === pickup.itemId && t.slot === player.slot)
    );
    const player = firstToucher(fixedPickupBox(pickup, rule.size), candidates);
    if (!player) continue;
    pickup.respawnTimer = rule.respawnSeconds;
    taken.push({ itemId: pickup.itemId, slot: player.slot, x: pickup.x, y: pickup.y });
  }
  return taken;
}
