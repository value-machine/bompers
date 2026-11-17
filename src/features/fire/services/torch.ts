import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { Vec2 } from "@/shared/types/gameGeometry.types";
import { EMPTY_CELL, type TerrainGrid } from "@/features/arena/api/arenaApi";
import { helmetPoint } from "@/features/combat/api/combatApi";
import type { PlayerState } from "@/features/player/api/playerApi";
import { ignite } from "@/features/fire/services/fireSim";
import type { FireState } from "@/features/fire/types/fire.types";

/**
 * The torch (fire-spread b1; owner blast-power D8): while its holder sprays, `rays` rays fan out
 * from the helmet over ±`halfAngleDegrees` of the aim, each marching half a sample at a time up
 * to `length`. A ray stops at the first terrain it meets and lights it when it is fuel, so the
 * torch lights what it touches and never through a wall (D5). A blob a ray reaches before
 * terrain is pushed along the aim (`push`, units / s² for this step), directly on its velocity
 * like recoil (D7): at most √(2 · push · length) ≈ 390 units / s per spray, under a blast's push.
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
}

const solidAt = (grid: TerrainGrid, p: Vec2): number | null => {
  const cx = Math.floor(p.x / grid.cellSize);
  const cy = Math.floor(p.y / grid.cellSize);
  if (cx < 0 || cy < 0 || cx >= grid.widthCells || cy >= grid.heightCells) return null;
  const index = cy * grid.widthCells + cx;
  return (grid.cells[index] ?? EMPTY_CELL) === EMPTY_CELL ? null : index;
};

/** A blob whose body circle holds `p` (not the holder). */
const blobAt = (args: TorchSprayArgs, p: Vec2): PlayerState | undefined =>
  args.players.find((player) => {
    if (player === args.holder) return false;
    const r = player.width / 2;
    return Math.hypot(p.x - player.x, p.y - (player.y - player.height / 2)) <= r;
  });

/** Directions of the cone's rays: evenly spread over ±half-angle of the aim. */
function rayDirections(aim: Vec2, torch: GameTunables["combat"]["torch"]): Vec2[] {
  const base = Math.atan2(aim.y, aim.x);
  const half = (torch.halfAngleDegrees * Math.PI) / 180;
  return Array.from({ length: torch.rays }, (_, i) => {
    const a = torch.rays === 1 ? base : base - half + (2 * half * i) / (torch.rays - 1);
    return { x: Math.cos(a), y: Math.sin(a) };
  });
}

interface RayHit {
  end: Vec2;
  /** Terrain sample the ray stopped at, if any. */
  sample: number | null;
  blobs: PlayerState[];
}

/** Marches one ray: blobs it passes, and the first terrain it meets. */
function castRay(args: TorchSprayArgs, from: Vec2, dir: Vec2): RayHit {
  const { length } = args.tunables.combat.torch;
  const step = args.terrain.cellSize / 2;
  const blobs: PlayerState[] = [];
  for (let s = step; s <= length; s += step) {
    const p = { x: from.x + dir.x * s, y: from.y + dir.y * s };
    const sample = solidAt(args.terrain, p);
    if (sample !== null) return { end: p, sample, blobs };
    const blob = blobAt(args, p);
    if (blob && !blobs.includes(blob)) blobs.push(blob);
  }
  return { end: { x: from.x + dir.x * length, y: from.y + dir.y * length }, sample: null, blobs };
}

/** Pushes each blob once along the aim for this step. */
function pushBlobs(blobs: ReadonlySet<PlayerState>, push: { aim: Vec2; args: TorchSprayArgs }) {
  const { aim, args } = push;
  const dv = args.tunables.combat.torch.push * args.dt;
  for (const blob of blobs) {
    blob.vx += aim.x * dv;
    blob.vy += aim.y * dv;
  }
}

/** One step of spraying: light what the cone touches, push the blobs in it, record the spray. */
export function sprayTorch(fire: FireState, args: TorchSprayArgs): void {
  const origin = helmetPoint(args.holder);
  const aimLength = Math.hypot(args.holder.aimX, args.holder.aimY) || 1;
  const aim = { x: args.holder.aimX / aimLength, y: args.holder.aimY / aimLength };
  const pushed = new Set<PlayerState>();
  const ends: Vec2[] = [];
  for (const dir of rayDirections(aim, args.tunables.combat.torch)) {
    const hit = castRay(args, origin, dir);
    ends.push(hit.end);
    if (hit.sample !== null) ignite(fire, args.terrain, { index: hit.sample, time: args.now });
    for (const blob of hit.blobs) pushed.add(blob);
  }
  pushBlobs(pushed, { aim, args });
  fire.sprays = fire.sprays.filter((spray) => spray.slot !== args.holder.slot);
  fire.sprays.push({ slot: args.holder.slot, origin, ends, atSeconds: args.now });
}
