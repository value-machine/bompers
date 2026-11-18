import type { GameTunables } from "@/shared/types/gameTunables.types";
import { castRayFan, pushAlongAim } from "@/shared/utils/rayFan";
import { terrainBodies, type TerrainGrid } from "@/features/arena/api/arenaApi";
import { helmetPoint } from "@/features/combat/api/combatApi";
import type { PlayerState } from "@/features/player/api/playerApi";
import { chillBlob } from "@/features/ice/services/frozenBlobs";
import { feedCold } from "@/features/ice/services/iceSim";
import type { IceState } from "@/features/ice/types/ice.types";

/**
 * The freeze ray (owner, ice-element D1): the torch's twin on the same shared ray fan
 * (`castRayFan`), as a narrow beam. While its holder holds fire, each ray stops at the first
 * terrain it meets; the cold flows out from those samples for this step (`feedCold`), so the
 * ice grows where the beam points for as long as it is held (D3, D8). A blob the beam reaches
 * before terrain is pushed lightly along the aim and gathers chill (`chillBlob`, frozen blobs).
 */
export interface FreezeRayArgs {
  terrain: TerrainGrid;
  /** Players in play (the holder too; it is never pushed by its own beam). */
  players: readonly PlayerState[];
  holder: PlayerState;
  tunables: GameTunables;
  /** Sim time of this step, seconds. */
  now: number;
  dt: number;
  /** How far the beam goes this step (shorter in a beam clash); the ray's length when left out. */
  reach?: number;
  /** Blobs the beam may chill (not one in a dive or under spawn protection); all when left out. */
  canChill?: (player: PlayerState) => boolean;
}

/** One step of holding the ray: freeze what it touches, push the blobs in it, record the beam. */
export function sprayFreezeRay(ice: IceState, args: FreezeRayArgs): void {
  const { terrain, tunables, holder } = args;
  const ray = tunables.combat.freezeRay;
  const hits = castRayFan({
    fields: terrainBodies(terrain),
    bodies: args.players.filter((player) => player !== holder),
    origin: helmetPoint(holder),
    aim: { x: holder.aimX, y: holder.aimY },
    shape: { ...ray, length: args.reach ?? ray.length },
  });
  const samples = hits.rays.flatMap((hit) =>
    // A ray that ends on a moving part stops there; parts take no cold yet (mover-materials L1).
    hit.sample === null || hit.body !== 0 ? [] : [hit.sample]
  );
  feedCold(ice, terrain, { slot: holder.slot, samples, now: args.now, dt: args.dt, tunables });
  pushAlongAim(hits, { accel: ray.push, dt: args.dt });
  for (const blob of hits.bodies) {
    if (args.canChill && !args.canChill(blob)) continue;
    chillBlob(ice, blob, { now: args.now, dt: args.dt, tunables });
  }
  ice.rays = ice.rays.filter((beam) => beam.slot !== holder.slot);
  ice.rays.push({
    slot: holder.slot,
    origin: hits.origin,
    ends: hits.rays.map((hit) => hit.end),
    touched: hits.rays.map((hit) => hit.sample !== null),
    atSeconds: args.now,
  });
}
