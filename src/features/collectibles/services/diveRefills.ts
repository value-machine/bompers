import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { Rect } from "@/shared/types/gameGeometry.types";
import type { LevelCollectible } from "@/features/level/api/levelApi";
import type { PlayerState } from "@/features/player/api/playerApi";
import { firstToucher } from "@/features/collectibles/services/skyDrops";
import type {
  DiveRefillCollected,
  DiveRefillPickup,
  PickupBurst,
} from "@/features/collectibles/types/collectibles.types";

/**
 * Headbutt resets (FEEDBACK_ROUND_2 § 2.3; Celeste's dash-refill crystal): a fixed dive-refill
 * pickup on each `dive-reset` collectible point, present from the match start. The first player
 * passed in that touches it takes it; it is then gone for `respawnSeconds` and comes back on its
 * point. Who may take one (a player whose dive charge is spent) is the match's call, so this
 * feature knows nothing about dives. Pure TS, no randomness or clock.
 */
export const DIVE_REFILL_ITEM = "dive-reset";

export function createDiveRefills(points: readonly LevelCollectible[]): DiveRefillPickup[] {
  return points.flatMap((point, pointIndex) =>
    point.itemId === DIVE_REFILL_ITEM
      ? [{ pointIndex, x: point.at.x, y: point.at.y, respawnTimer: 0, presentSeconds: 0 }]
      : []
  );
}

export interface StepDiveRefillsArgs {
  refills: DiveRefillPickup[];
  /** Players allowed to take one this step (in play, dive charge spent). */
  players: readonly PlayerState[];
  tunables: GameTunables;
  dt: number;
  /** Where a taken reset's burst goes (the collectibles state's `bursts`; render only). */
  bursts: PickupBurst[];
}

export const diveRefillBox = (refill: DiveRefillPickup, size: number): Rect => ({
  x: refill.x - size / 2,
  y: refill.y - size / 2,
  w: size,
  h: size,
});

/** Counts the respawn down; true while the pickup is still gone after this step. */
function tickRespawn(refill: DiveRefillPickup, dt: number): boolean {
  if (refill.respawnTimer <= 0) return false;
  const left = refill.respawnTimer - dt;
  // Float drift must not cost a whole extra step.
  refill.respawnTimer = left > 1e-9 ? left : 0;
  refill.presentSeconds = 0;
  return true;
}

/**
 * Counts respawns down and hands present pickups to the first player touching them. A player
 * takes at most one per step: the charge it refills is a single one.
 */
export function stepDiveRefills(args: StepDiveRefillsArgs): DiveRefillCollected[] {
  const { respawnSeconds, size } = args.tunables.collectibles.diveRefill;
  let candidates = args.players;
  const collected: DiveRefillCollected[] = [];
  for (const refill of args.refills) {
    if (tickRespawn(refill, args.dt)) continue;
    refill.presentSeconds += args.dt;
    const player = firstToucher(diveRefillBox(refill, size), candidates);
    if (!player) continue;
    refill.respawnTimer = respawnSeconds;
    collected.push({ slot: player.slot, x: refill.x, y: refill.y });
    const burst = { id: refill.pointIndex, itemId: DIVE_REFILL_ITEM, ageSeconds: 0 } as const;
    args.bursts.push({ ...burst, x: refill.x, y: refill.y });
    candidates = candidates.filter((candidate) => candidate !== player);
  }
  return collected;
}
