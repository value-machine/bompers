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
  burnOut,
  getCellInfo,
  isFrozenSample,
  type ClearedCells,
  type TerrainGrid,
} from "@/features/arena/api/arenaApi";
import type { FireState } from "@/features/fire/types/fire.types";

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
 */
export function createFireState(grid: TerrainGrid): FireState {
  const count = grid.widthCells * grid.heightCells;
  const front = createSampleFront(count);
  return {
    front,
    igniteAt: front.arriveAt,
    lit: [],
    litHead: 0,
    dueOut: [],
    nextBurnOutAt: 0,
    frozenSeen: grid.frozenVersion,
    scorched: new Uint8Array(count),
    version: 0,
    sprays: [],
    blobs: new Map(),
    blobGraceUntil: new Map(),
    blobMoments: [],
    caughtCounts: {},
    dousedCounts: {},
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

/** Sets a sample to catch at `time` if that is sooner than it would; false when it can't burn. */
export function ignite(
  fire: FireState,
  grid: TerrainGrid,
  at: { index: number; time: number }
): boolean {
  return canBurn(grid, at.index) && queueArrival(fire.front, at.index, at.time);
}

// ── Spread ───────────────────────────────────────────────────────────────────

function markScorched(fire: FireState, index: number): void {
  if (fire.scorched[index] === 1) return;
  fire.scorched[index] = 1;
  fire.version += 1;
}

/** Lights every pending ignition due by `now`; breakable non-fuel next to fire is scorched. */
function spread(fire: FireState, grid: TerrainGrid, at: { now: number; pace: number }): void {
  advanceFront(fire.front, grid, {
    now: at.now,
    pace: at.pace,
    canEnter: (index) => canBurn(grid, index),
    onArrive: (index) => {
      fire.lit.push(index);
      fire.version += 1;
    },
    onBlocked: (index) => {
      const info = getCellInfo(grid, index % grid.widthCells, Math.floor(index / grid.widthCells));
      if (info && !info.burns && info.toughness !== null) markScorched(fire, index);
    },
  });
}

/**
 * Puts out burning samples that froze since the last step (ice-element D6): they stop burning,
 * stay standing and can catch again once thawed.
 */
function douseFrozen(fire: FireState, grid: TerrainGrid): void {
  if (fire.frozenSeen === grid.frozenVersion) return;
  fire.frozenSeen = grid.frozenVersion;
  const stillBurns = (index: number): boolean => {
    if (!isFrozenSample(grid, index)) return true;
    clearArrival(fire.front, index);
    return false;
  };
  const burning = fire.lit.length - fire.litHead + fire.dueOut.length;
  fire.lit = fire.lit.slice(fire.litHead).filter(stillBurns);
  fire.litHead = 0;
  fire.dueOut = fire.dueOut.filter(stillBurns);
  if (fire.lit.length + fire.dueOut.length !== burning) fire.version += 1;
}

// ── Burn-out ─────────────────────────────────────────────────────────────────

/** Moves samples lit at least `burnSeconds` ago to the batch waiting for removal. */
function collectBurnt(fire: FireState, burnSeconds: number, now: number): void {
  while (fire.litHead < fire.lit.length) {
    const index = fire.lit[fire.litHead]!;
    if ((fire.igniteAt[index] ?? Infinity) + burnSeconds > now) break;
    fire.dueOut.push(index);
    fire.litHead += 1;
  }
  if (fire.litHead > 1024 && fire.litHead * 2 > fire.lit.length) {
    fire.lit = fire.lit.slice(fire.litHead);
    fire.litHead = 0;
  }
}

/** Samples still burning (lit, not yet removed), for the renderer. */
export function burningSamples(fire: FireState): number[] {
  return [...fire.lit.slice(fire.litHead), ...fire.dueOut];
}

/** A burnt-out batch: what was removed, and a few places in it for the debris to fly from. */
export interface BurnOutBatch extends ClearedCells {
  /** Centres of up to `MAX_BURN_OUT_SPOTS` of the batch's samples, spread over the batch. */
  spots: Vec2[];
}

const MAX_BURN_OUT_SPOTS = 3;
/** One debris spot per this many burnt samples (a small batch gets one). */
const SAMPLES_PER_SPOT = 16;

/**
 * Where a batch shows its debris: a fire burns out along a front, not round one centre, so the
 * spots are samples of the batch itself, picked evenly through it.
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

/**
 * Advances fire to sim time `now`: lights what the front has reached, then, on the batch beat,
 * removes what has burnt out. Returns what was removed this step (for effects / sound), or null.
 */
export function stepFire(
  fire: FireState,
  grid: TerrainGrid,
  frame: { now: number; tunables: GameTunables }
): BurnOutBatch | null {
  const { spreadSpeed, burnSeconds, burnOutInterval } = frame.tunables.fire;
  // Sprays not renewed this step have stopped (the torch sprays before this step runs).
  fire.sprays = fire.sprays.filter((spray) => spray.atSeconds >= frame.now);
  douseFrozen(fire, grid);
  spread(fire, grid, { now: frame.now, pace: 1 / spreadSpeed });
  collectBurnt(fire, burnSeconds, frame.now);
  if (frame.now < fire.nextBurnOutAt || fire.dueOut.length === 0) return null;
  fire.nextBurnOutAt = frame.now + burnOutInterval;
  const spots = burnOutSpots(grid, fire.dueOut);
  const cleared = burnOut(grid, fire.dueOut);
  fire.dueOut = [];
  fire.version += 1;
  return cleared.removed > 0 ? { ...cleared, spots } : null;
}
