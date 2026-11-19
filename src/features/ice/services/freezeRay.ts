import type { GameTunables } from "@/shared/types/gameTunables.types";
import { castRayFan, pushAlongAim, type RayHit } from "@/shared/utils/rayFan";
import { terrainBodies, type TerrainGrid } from "@/features/arena/api/arenaApi";
import { helmetPoint } from "@/features/combat/api/combatApi";
import { hurtHeight, weaponAim, type PlayerState } from "@/features/player/api/playerApi";
import { chillBlob } from "@/features/ice/services/frozenBlobs";
import { feedCold } from "@/features/ice/services/iceSim";
import type { IceState } from "@/features/ice/types/ice.types";

/**
 * The freeze ray (owner, ice-element D1): the torch's twin on the same shared ray fan
 * (`castRayFan`), as a narrow beam. While its holder holds fire, each ray stops at the first
 * terrain or moving part it meets; the cold flows out from those samples for this step, on the
 * body they belong to (`feedCold`), so the
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

/**
 * The cold flows on the body each ray touches: the ground or a moving part (mover-materials
 * lap 2b). A fan split over bodies splits its ice by the rays on each, so a step never makes
 * more ice than one ray's worth.
 */
function feedTouchedBodies(ice: IceState, rays: readonly RayHit[], args: FreezeRayArgs): void {
  const byBody = new Map<number, number[]>();
  for (const hit of rays) {
    if (hit.sample === null) continue;
    byBody.set(hit.body, [...(byBody.get(hit.body) ?? []), hit.sample]);
  }
  const touching = [...byBody.values()].reduce((sum, samples) => sum + samples.length, 0);
  const { terrain, holder, tunables, now, dt } = args;
  for (const [body, samples] of byBody) {
    const share = samples.length / touching;
    feedCold(ice, terrain, { slot: holder.slot, body, samples, share, now, dt, tunables });
  }
}

/** One step of holding the ray: freeze what it touches, push the blobs in it, record the beam. */
export function sprayFreezeRay(ice: IceState, args: FreezeRayArgs): void {
  const { terrain, tunables, holder } = args;
  const ray = tunables.combat.freezeRay;
  const hits = castRayFan({
    fields: terrainBodies(terrain),
    bodies: args.players.filter((player) => player !== holder),
    hitHeight: hurtHeight,
    origin: helmetPoint(holder),
    aim: weaponAim(holder),
    shape: { ...ray, length: args.reach ?? ray.length },
  });
  feedTouchedBodies(ice, hits.rays, args);
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
