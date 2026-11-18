import type { Vec2 } from "@/shared/types/gameGeometry.types";
import type { GameTunables } from "@/shared/types/gameTunables.types";
import {
  SAMPLE_NEIGHBOURS,
  advanceFront,
  clearArrival,
  createSampleFront,
  queueArrival,
} from "@/shared/utils/sampleFront";
import {
  bodyGrids,
  bodyWorldPoint,
  burnOut,
  getCellInfo,
  isFrozenSample,
  type ClearedCells,
  type ClearedLook,
  type TerrainGrid,
} from "@/features/arena/api/arenaApi";
import type { FireState, GroundFire } from "@/features/fire/types/fire.types";

/**
 * Fire on the terrain field (fire-spread b1; owner rules blast-power D5, D6, D18): fire is an
 * arrival time per sample, spread by the shared sample front (`shared/utils/sampleFront`, also
 * the freeze ray's; ice-element D4). A lit sample lights each touching fuel sample at its own time plus the step
 * length over `fire.spreadSpeed`, so the front runs outward at the same speed every way through
 * solid fuel and never crosses air (D9: a diagonal step needs a solid sample beside it). Fuel = a
 * `burns` material; fuel with a `douses` sample among its 8 neighbours never catches, and a
 * frozen sample never does (the fire stops at it; freezing a burning sample puts it out).
 * Breakable non-fuel next to fire (earth) is scorched and stops it; stone just blocks. A lit
 * sample burns `fire.burnSeconds`, then is removed with the next batch every
 * `fire.burnOutInterval` (one terrain write and one effect per batch).
 *
 * Every body of the arena has its own ground fire (mover-materials-l2 D3): the static terrain
 * and each moving part's field, in the arena's `bodyGrids` order. A fire spreads inside its own
 * body only; a part's fire rides with the part because it lives on the part's field.
 */
const createGroundFire = (grid: TerrainGrid): GroundFire => {
  const count = grid.widthCells * grid.heightCells;
  const front = createSampleFront(count);
  return {
    front,
    igniteAt: front.arriveAt,
    lit: [],
    litHead: 0,
    dueOut: [],
    frozenSeen: grid.frozenVersion,
    scorched: new Uint8Array(count),
    version: 0,
  };
};

export function createFireState(terrain: TerrainGrid): FireState {
  return {
    grounds: bodyGrids(terrain).map(createGroundFire),
    nextBurnOutAt: 0,
    sprays: [],
  };
}

// ── Fuel ─────────────────────────────────────────────────────────────────────

/**
 * Fuel that can catch: a `burns` sample that is not frozen and has no `douses` sample among its
 * 8 neighbours (D5).
 */
export function canBurn(grid: TerrainGrid, index: number): boolean {
  const cx = index % grid.widthCells;
  const cy = Math.floor(index / grid.widthCells);
  if (!getCellInfo(grid, cx, cy)?.burns || isFrozenSample(grid, index)) return false;
  return SAMPLE_NEIGHBOURS.every(
    ([dx, dy]) => getCellInfo(grid, cx + dx, cy + dy)?.douses !== true
  );
}

/** A sample of one body: `index` in the grid of body `body` (0 = the static terrain). */
export interface BodySample {
  body: number;
  index: number;
}

/**
 * Sets a sample of a body to catch at `time` if that is sooner than it would; false when it
 * can't burn.
 */
export function ignite(
  fire: FireState,
  terrain: TerrainGrid,
  at: BodySample & { time: number }
): boolean {
  const ground = fire.grounds[at.body];
  const grid = bodyGrids(terrain)[at.body];
  if (!ground || !grid) return false;
  return canBurn(grid, at.index) && queueArrival(ground.front, at.index, at.time);
}

// ── Spread ───────────────────────────────────────────────────────────────────

function markScorched(ground: GroundFire, index: number): void {
  if (ground.scorched[index] === 1) return;
  ground.scorched[index] = 1;
  ground.version += 1;
}

/** Lights every pending ignition due by `now`; breakable non-fuel next to fire is scorched. */
function spread(ground: GroundFire, grid: TerrainGrid, at: { now: number; pace: number }): void {
  advanceFront(ground.front, grid, {
    now: at.now,
    pace: at.pace,
    canEnter: (index) => canBurn(grid, index),
    onArrive: (index) => {
      ground.lit.push(index);
      ground.version += 1;
    },
    onBlocked: (index) => {
      const info = getCellInfo(grid, index % grid.widthCells, Math.floor(index / grid.widthCells));
      if (info && !info.burns && info.toughness !== null) markScorched(ground, index);
    },
  });
}

/**
 * Puts out burning samples that froze since the last step (ice-element D6): they stop burning,
 * stay standing and can catch again once thawed.
 */
function douseFrozen(ground: GroundFire, grid: TerrainGrid): void {
  if (ground.frozenSeen === grid.frozenVersion) return;
  ground.frozenSeen = grid.frozenVersion;
  const stillBurns = (index: number): boolean => {
    if (!isFrozenSample(grid, index)) return true;
    clearArrival(ground.front, index);
    return false;
  };
  const burning = ground.lit.length - ground.litHead + ground.dueOut.length;
  ground.lit = ground.lit.slice(ground.litHead).filter(stillBurns);
  ground.litHead = 0;
  ground.dueOut = ground.dueOut.filter(stillBurns);
  if (ground.lit.length + ground.dueOut.length !== burning) ground.version += 1;
}

// ── Burn-out ─────────────────────────────────────────────────────────────────

/** Moves samples lit at least `burnSeconds` ago to the batch waiting for removal. */
function collectBurnt(ground: GroundFire, burnSeconds: number, now: number): void {
  while (ground.litHead < ground.lit.length) {
    const index = ground.lit[ground.litHead]!;
    if ((ground.igniteAt[index] ?? Infinity) + burnSeconds > now) break;
    ground.dueOut.push(index);
    ground.litHead += 1;
  }
  if (ground.litHead > 1024 && ground.litHead * 2 > ground.lit.length) {
    ground.lit = ground.lit.slice(ground.litHead);
    ground.litHead = 0;
  }
}

/** Samples of one body still burning (lit, not yet removed), for the renderer. */
export function burningSamples(ground: GroundFire): number[] {
  return [...ground.lit.slice(ground.litHead), ...ground.dueOut];
}

/** How many samples are lit and not yet burnt out, over all bodies (the fire's sound). */
export const burningCount = (fire: FireState): number =>
  fire.grounds.reduce((sum, ground) => sum + ground.lit.length - ground.litHead, 0);

/** A burnt-out batch: what was removed, and a few places in it for the debris to fly from. */
export interface BurnOutBatch {
  removed: number;
  byLook: ClearedLook[];
  /** World centres of up to `MAX_BURN_OUT_SPOTS` of the batch's samples, spread over the batch. */
  spots: Vec2[];
}

const MAX_BURN_OUT_SPOTS = 3;
/** One debris spot per this many burnt samples (a small batch gets one). */
const SAMPLES_PER_SPOT = 16;

/**
 * Where a batch shows its debris: a fire burns out along a front, not round one centre, so the
 * spots are samples of the batch itself, picked evenly through it (in the body's own grid).
 */
function burnOutSpots(grid: TerrainGrid, samples: readonly number[]): Vec2[] {
  const count = Math.min(MAX_BURN_OUT_SPOTS, Math.ceil(samples.length / SAMPLES_PER_SPOT));
  return Array.from({ length: count }, (_, i) => {
    const index = samples[Math.floor(((i + 0.5) * samples.length) / count)] ?? 0;
    return {
      x: ((index % grid.widthCells) + 0.5) * grid.cellSize,
      y: (Math.floor(index / grid.widthCells) + 0.5) * grid.cellSize,
    };
  });
}

/** Adds one body's removed samples to the batch, pooling looks that are the same. */
function addCleared(batch: BurnOutBatch, cleared: ClearedCells): void {
  batch.removed += cleared.removed;
  for (const look of cleared.byLook) {
    const same = batch.byLook.find(
      (known) => known.materialId === look.materialId && known.colorId === look.colorId
    );
    if (same) same.cells += look.cells;
    else batch.byLook.push({ ...look });
  }
}

/** Removes what has burnt out on every body; the batch of all of them, or null when nothing went. */
function burnOutBodies(fire: FireState, terrain: TerrainGrid): BurnOutBatch | null {
  const batch: BurnOutBatch = { removed: 0, byLook: [], spots: [] };
  bodyGrids(terrain).forEach((grid, body) => {
    const ground = fire.grounds[body];
    if (!ground || ground.dueOut.length === 0) return;
    const spots = burnOutSpots(grid, ground.dueOut).map((at) => bodyWorldPoint(terrain, body, at));
    addCleared(batch, burnOut(grid, ground.dueOut));
    batch.spots.push(...spots);
    ground.dueOut = [];
    ground.version += 1;
  });
  batch.spots = batch.spots.slice(0, MAX_BURN_OUT_SPOTS);
  return batch.removed > 0 ? batch : null;
}

/**
 * Advances fire to sim time `now` on every body: lights what each front has reached, then, on
 * the batch beat, removes what has burnt out. Returns what was removed this step (for effects /
 * sound), or null.
 */
export function stepFire(
  fire: FireState,
  terrain: TerrainGrid,
  frame: { now: number; tunables: GameTunables }
): BurnOutBatch | null {
  const { spreadSpeed, burnSeconds, burnOutInterval } = frame.tunables.fire;
  // Sprays not renewed this step have stopped (the torch sprays before this step runs).
  fire.sprays = fire.sprays.filter((spray) => spray.atSeconds >= frame.now);
  bodyGrids(terrain).forEach((grid, body) => {
    const ground = fire.grounds[body];
    if (!ground) return;
    douseFrozen(ground, grid);
    spread(ground, grid, { now: frame.now, pace: 1 / spreadSpeed });
    collectBurnt(ground, burnSeconds, frame.now);
  });
  const due = fire.grounds.some((ground) => ground.dueOut.length > 0);
  if (frame.now < fire.nextBurnOutAt || !due) return null;
  fire.nextBurnOutAt = frame.now + burnOutInterval;
  return burnOutBodies(fire, terrain);
}
