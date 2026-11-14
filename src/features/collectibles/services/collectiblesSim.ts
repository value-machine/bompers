import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { Rect } from "@/shared/types/gameGeometry.types";
import type { LevelCollectible } from "@/features/level/api/levelApi";
import { playerBody, type PlayerState } from "@/features/player/api/playerApi";
import type {
  CollectiblesState,
  OrbCollected,
  PointOrb,
} from "@/features/collectibles/types/collectibles.types";

/**
 * Point-orb system. Deterministic schedule (no randomness in the sim, like combat D6): after
 * `firstDelaySeconds`, then every `intervalSeconds` while fewer than `maxActive` orbs exist,
 * the next free `point-orb` collectible point (round-robin) gets an orb `dropHeight` above it.
 * The orb falls with the match gravity onto its authored point and hovers there (no terrain
 * collision, so a blasted floor never strands it). The first player touching it takes it.
 */
export const POINT_ORB_ITEM = "point-orb";

export function createCollectiblesState(tunables: GameTunables): CollectiblesState {
  return {
    orbs: [],
    spawnTimer: tunables.collectibles.firstDelaySeconds,
    nextPointIndex: 0,
    nextId: 1,
  };
}

export interface StepCollectiblesArgs {
  collectibles: CollectiblesState;
  /** The level's collectible points; only `point-orb` items spawn orbs. */
  points: readonly LevelCollectible[];
  /** Players in play (waiting-to-respawn players cannot collect). */
  players: readonly PlayerState[];
  tunables: GameTunables;
  dt: number;
}

/** The next point index (round-robin from `nextPointIndex`) that takes an orb, or -1. */
function nextFreePoint(state: CollectiblesState, points: readonly LevelCollectible[]): number {
  for (let k = 0; k < points.length; k += 1) {
    const index = (state.nextPointIndex + k) % points.length;
    const point = points[index];
    const taken = state.orbs.some((orb) => orb.pointIndex === index);
    if (point?.itemId === POINT_ORB_ITEM && !taken) return index;
  }
  return -1;
}

function spawnOrb(args: StepCollectiblesArgs): void {
  const { collectibles: state, points, tunables } = args;
  const index = nextFreePoint(state, points);
  const point = points[index];
  if (!point) return;
  state.nextPointIndex = (index + 1) % points.length;
  state.orbs.push({
    id: state.nextId,
    pointIndex: index,
    x: point.at.x,
    y: point.at.y - tunables.collectibles.dropHeight,
    restY: point.at.y,
    vy: 0,
  });
  state.nextId += 1;
}

function stepSchedule(args: StepCollectiblesArgs): void {
  const { collectibles: state, tunables, dt } = args;
  state.spawnTimer -= dt;
  if (state.spawnTimer > 0) return;
  state.spawnTimer = tunables.collectibles.intervalSeconds;
  if (state.orbs.length < tunables.collectibles.maxActive) spawnOrb(args);
}

function fall(orb: PointOrb, tunables: GameTunables, dt: number): void {
  if (orb.y >= orb.restY) return;
  orb.vy = Math.min(tunables.world.maxFallSpeed, orb.vy + tunables.world.gravity * dt);
  orb.y = Math.min(orb.restY, orb.y + orb.vy * dt);
  if (orb.y === orb.restY) orb.vy = 0;
}

export const orbBox = (orb: PointOrb, size: number): Rect => ({
  x: orb.x - size / 2,
  y: orb.y - size / 2,
  w: size,
  h: size,
});

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

function collector(orb: PointOrb, args: StepCollectiblesArgs): PlayerState | undefined {
  const box = orbBox(orb, args.tunables.collectibles.size);
  return args.players.find((player) => overlaps(box, playerBody(player)));
}

/** Advances spawns, falls and pickups one step. Returns the orbs taken this step. */
export function stepCollectibles(args: StepCollectiblesArgs): OrbCollected[] {
  stepSchedule(args);
  const collected: OrbCollected[] = [];
  args.collectibles.orbs = args.collectibles.orbs.filter((orb) => {
    fall(orb, args.tunables, args.dt);
    const player = collector(orb, args);
    if (!player) return true;
    collected.push({ slot: player.slot, x: orb.x, y: orb.y });
    return false;
  });
  return collected;
}
