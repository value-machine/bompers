import type { GameTunables } from "@/shared/types/gameTunables.types";
import { advanceFront, createSampleFront, queueArrival } from "@/shared/utils/sampleFront";
import {
  getCellInfo,
  isFrozenSample,
  setSampleFrozen,
  type TerrainGrid,
} from "@/features/arena/api/arenaApi";
import type { ColdFeed, IceState } from "@/features/ice/types/ice.types";

/**
 * Frozen ground on the terrain field (owner, ice-element D1–D8). The cold flows out from where
 * a freeze ray touches the ground: every second of beam makes the same amount of ice
 * (`ice.freezeAreaPerSecond`), and each bit of it lands on the nearest ground that is not frozen
 * yet, measured through solid ground from the touched samples and never across air. So the ice
 * always grows where the beam points: on fresh ground a round patch, on a frozen patch its
 * nearest edge. "Nearest first" is the shared sample front run on distance instead of time (the
 * same front fire spreads on), stopped when the step's ice is spent. A frozen sample is the
 * arena's flag (slippery, not cut by blasts, closed to fire) for `ice.frozenSeconds`, then it
 * thaws by itself; the torch can thaw it sooner. Ice terrain is never entered or crossed.
 */
export function createIceState(grid: TerrainGrid): IceState {
  return {
    feeds: new Map(),
    thawAt: new Float32Array(grid.widthCells * grid.heightCells),
    frozen: [],
    frozenDue: [],
    frozenHead: 0,
    rays: [],
  };
}

/**
 * Most samples one feed may walk over in a step while looking for unfrozen ground: bounds the
 * cost of aiming at the middle of a very large frozen patch (the search goes on next step).
 */
const MAX_WALK_PER_STEP = 4000;

/** Ground the cold can travel through: solid and not ice terrain. */
const carriesCold = (grid: TerrainGrid, index: number): boolean => {
  const info = getCellInfo(grid, index % grid.widthCells, Math.floor(index / grid.widthCells));
  return info !== null && !info.douses;
};

/** Terrain the cold can freeze: ground it travels through that is not frozen yet. */
export const canFreeze = (grid: TerrainGrid, index: number): boolean =>
  carriesCold(grid, index) && !isFrozenSample(grid, index);

function feedOf(ice: IceState, grid: TerrainGrid, slot: number): ColdFeed {
  const known = ice.feeds.get(slot);
  if (known) return known;
  const feed: ColdFeed = {
    front: createSampleFront(grid.widthCells * grid.heightCells),
    seedKey: -1,
    budget: 0,
    fedAt: -Infinity,
  };
  ice.feeds.set(slot, feed);
  return feed;
}

/** Starts the feed's distances over from the samples the beam touches now. */
function reseed(feed: ColdFeed, touched: readonly number[], key: number): void {
  feed.front.arriveAt.fill(Infinity);
  feed.front.heapIndex.length = 0;
  feed.front.heapTime.length = 0;
  feed.seedKey = key;
  for (const index of touched) queueArrival(feed.front, index, 0);
}

function freeze(ice: IceState, grid: TerrainGrid, at: { index: number; due: number }): void {
  if (!setSampleFrozen(grid, at.index, true)) return;
  ice.thawAt[at.index] = at.due;
  ice.frozen.push(at.index);
  ice.frozenDue.push(at.due);
}

export interface ColdStep {
  /** The player slot whose ray this is. */
  slot: number;
  /** Terrain samples the ray's beams ended on this step. */
  samples: readonly number[];
  /** Sim time of this step and its length, seconds. */
  now: number;
  dt: number;
  tunables: GameTunables;
}

/**
 * One step of a freeze ray on the ground: adds this step's ice to the ray's budget and places
 * it, nearest unfrozen ground first. A beam on air or on ice terrain makes nothing.
 */
export function feedCold(ice: IceState, grid: TerrainGrid, step: ColdStep): void {
  const touched = step.samples.filter((index) => carriesCold(grid, index));
  if (touched.length === 0) return;
  const { freezeAreaPerSecond, frozenSeconds } = step.tunables.ice;
  const feed = feedOf(ice, grid, step.slot);
  const key = Math.min(...touched);
  const paused = step.now - feed.fedAt > step.dt * 1.5;
  if (paused) feed.budget = 0;
  // The beam moved, or came back after a pause: distances count from where it touches now.
  if (paused || feed.seedKey !== key) reseed(feed, touched, key);
  feed.fedAt = step.now;
  feed.budget += (freezeAreaPerSecond * step.dt) / (grid.cellSize * grid.cellSize);
  // Stored as a 32-bit float; the queue keeps the same rounded value so stale entries show.
  const due = Math.fround(step.now + frozenSeconds);
  let walked = 0;
  advanceFront(feed.front, grid, {
    now: Infinity,
    pace: 1,
    canEnter: (index) => carriesCold(grid, index),
    until: (index) => {
      walked += 1;
      return walked > MAX_WALK_PER_STEP || (feed.budget < 1 && !isFrozenSample(grid, index));
    },
    onArrive: (index) => {
      if (isFrozenSample(grid, index)) return;
      feed.budget -= 1;
      freeze(ice, grid, { index, due });
    },
  });
  // Nothing left to freeze within reach: the unspent ice is not saved up.
  if (feed.front.heapIndex.length === 0) feed.budget = Math.min(feed.budget, 1);
}

/** Thaws the samples whose frozen time is over, oldest first. */
function thawDue(ice: IceState, grid: TerrainGrid, now: number): void {
  while (ice.frozenHead < ice.frozen.length) {
    const index = ice.frozen[ice.frozenHead]!;
    const due = ice.frozenDue[ice.frozenHead]!;
    if (due > now) break;
    ice.frozenHead += 1;
    // Stale: frozen again since (its later entry thaws it).
    if (ice.thawAt[index] !== due) continue;
    ice.thawAt[index] = 0;
    setSampleFrozen(grid, index, false);
  }
  if (ice.frozenHead > 1024 && ice.frozenHead * 2 > ice.frozen.length) {
    ice.frozen = ice.frozen.slice(ice.frozenHead);
    ice.frozenDue = ice.frozenDue.slice(ice.frozenHead);
    ice.frozenHead = 0;
  }
}

/** Advances the ice to sim time `now` (after this step's freeze rays): what is due thaws. */
export function stepIce(ice: IceState, grid: TerrainGrid, frame: { now: number }): void {
  // Beams not renewed this step have stopped (the ray is held before this step runs).
  ice.rays = ice.rays.filter((beam) => beam.atSeconds >= frame.now);
  thawDue(ice, grid, frame.now);
}
