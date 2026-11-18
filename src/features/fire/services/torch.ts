import type { GameTunables } from "@/shared/types/gameTunables.types";
import { castRayFan, pushAlongAim } from "@/shared/utils/rayFan";
import {
  bodyGrids,
  isFrozenSample,
  terrainBodies,
  thawAround,
  type TerrainGrid,
} from "@/features/arena/api/arenaApi";
import { helmetPoint } from "@/features/combat/api/combatApi";
import type { PlayerState } from "@/features/player/api/playerApi";
import { ignite } from "@/features/fire/services/fireSim";
import { catchFire } from "@/features/fire/services/burningBlobs";
import type { FireState } from "@/features/fire/types/fire.types";

/**
 * The torch (fire-spread b1; owner blast-power D8): while its holder sprays, the shared ray fan
 * (`castRayFan`) goes out from the helmet over ±`halfAngleDegrees` of the aim. A ray stops at the
 * first terrain or moving part it meets and lights it when it is fuel, so the torch lights what it touches and
 * never through a wall (D5). Frozen terrain is thawed first (ice-element D6): the flame always
 * turns it back to normal, and the next step lights it only if it is fuel. A blob a ray reaches
 * before terrain is pushed along the aim (`push`, units / s² for this step), directly on its
 * velocity like recoil (D7): at most √(2 · push · length) ≈ 390 units / s per spray, under a
 * blast's push, and catches fire (fire-burn b2, lit by the holder).
 */
export interface TorchSprayArgs {
  terrain: TerrainGrid;
  /** Players in play (the holder too; it is never pushed by its own flame). */
  players: readonly PlayerState[];
  holder: PlayerState;
  tunables: GameTunables;
  /** Sim time of this step, seconds. */
  now: number;
  dt: number;
  /** How far the flame goes this step (shorter in a beam clash); the torch's length when left out. */
  reach?: number;
}

/** One step of spraying: thaw or light what the cone touches, push the blobs in it, record it. */
export function sprayTorch(fire: FireState, args: TorchSprayArgs): void {
  const { terrain, tunables, holder } = args;
  const torch = tunables.combat.torch;
  const hits = castRayFan({
    fields: terrainBodies(terrain),
    bodies: args.players.filter((player) => player !== holder),
    origin: helmetPoint(holder),
    aim: { x: holder.aimX, y: holder.aimY },
    shape: { ...torch, length: args.reach ?? torch.length },
  });
  const grids = bodyGrids(terrain);
  for (const { sample, body } of hits.rays) {
    const grid = grids[body];
    if (sample === null || !grid) continue;
    // The flame acts on the body it touches: the ground or a moving part (mover-materials-l2).
    if (isFrozenSample(grid, sample)) thawAround(grid, sample, tunables.ice.torchThawRadius);
    else ignite(fire, terrain, { body, index: sample, time: args.now });
  }
  pushAlongAim(hits, { accel: torch.push, dt: args.dt });
  const lit = { now: args.now, fromX: holder.x, bySlot: holder.slot };
  for (const blob of hits.bodies) catchFire(fire, blob, lit);
  fire.sprays = fire.sprays.filter((spray) => spray.slot !== holder.slot);
  fire.sprays.push({
    slot: holder.slot,
    origin: hits.origin,
    ends: hits.rays.map((ray) => ray.end),
    atSeconds: args.now,
  });
}
