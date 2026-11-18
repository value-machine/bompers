import type { GameTunables } from "@/shared/types/gameTunables.types";
import { castRayFan, pushAlongAim } from "@/shared/utils/rayFan";
import type { TerrainGrid } from "@/features/arena/api/arenaApi";
import { helmetPoint } from "@/features/combat/api/combatApi";
import type { PlayerState } from "@/features/player/api/playerApi";
import { feedCold } from "@/features/ice/services/iceSim";
import type { IceState } from "@/features/ice/types/ice.types";

/**
 * The freeze ray (owner, ice-element D1): the torch's twin on the same shared ray fan
 * (`castRayFan`), as a narrow beam. While its holder holds fire, each ray stops at the first
 * terrain it meets; the cold flows out from those samples for this step (`feedCold`), so the
 * ice grows where the beam points for as long as it is held (D3, D8). A blob the beam reaches
 * before terrain is pushed lightly along the aim; freezing blobs is lap 2.
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
}

/** One step of holding the ray: freeze what it touches, push the blobs in it, record the beam. */
export function sprayFreezeRay(ice: IceState, args: FreezeRayArgs): void {
  const { terrain, tunables, holder } = args;
  const ray = tunables.combat.freezeRay;
  const hits = castRayFan({
    field: terrain,
    bodies: args.players.filter((player) => player !== holder),
    origin: helmetPoint(holder),
    aim: { x: holder.aimX, y: holder.aimY },
    shape: ray,
  });
  const samples = hits.rays.flatMap((hit) => (hit.sample === null ? [] : [hit.sample]));
  feedCold(ice, terrain, { slot: holder.slot, samples, now: args.now, dt: args.dt, tunables });
  pushAlongAim(hits, { accel: ray.push, dt: args.dt });
  ice.rays = ice.rays.filter((beam) => beam.slot !== holder.slot);
  ice.rays.push({
    slot: holder.slot,
    origin: hits.origin,
    ends: hits.rays.map((hit) => hit.end),
    touched: hits.rays.map((hit) => hit.sample !== null),
    atSeconds: args.now,
  });
}
