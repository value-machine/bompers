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
import { weaponAim, type PlayerState } from "@/features/player/api/playerApi";
import { ignite } from "@/features/fire/services/fireSim";
import type { FireState } from "@/features/fire/types/fire.types";

/**
 * The torch (fire-spread b1; owner blast-power D8): while its holder sprays, the shared ray fan
 * (`castRayFan`) goes out from the helmet over ±`halfAngleDegrees` of the aim. A ray stops at the
 * first terrain or moving part it meets and lights it when it is fuel, so the torch lights what it touches and
 * never through a wall (D5). Frozen terrain is thawed first (ice-element D6): the flame always
 * turns it back to normal, and the next step lights it only if it is fuel. A blob a ray reaches
 * before terrain is pushed along the aim (`push`, units / s² for this step), directly on its
 * velocity like recoil (D7): at most √(2 · push · length) ≈ 390 units / s per spray, under a
 * blast's push. The blobs the flame reached are returned: the match sets them alight through
 * the blob-fire feature (lit by the holder), so this feature does not import it.
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

/**
 * One step of spraying: thaw or light what the cone touches, push the blobs in it, record it.
 * Returns the blobs the flame reached this step.
 */
export function sprayTorch(fire: FireState, args: TorchSprayArgs): PlayerState[] {
  const { terrain, tunables, holder } = args;
  const torch = tunables.combat.torch;
  const hits = castRayFan({
    fields: terrainBodies(terrain),
    bodies: args.players.filter((player) => player !== holder),
    origin: helmetPoint(holder),
    aim: weaponAim(holder),
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
  fire.sprays = fire.sprays.filter((spray) => spray.slot !== holder.slot);
  fire.sprays.push({
    slot: holder.slot,
    origin: hits.origin,
    ends: hits.rays.map((ray) => ray.end),
    atSeconds: args.now,
  });
  return [...hits.bodies];
}
