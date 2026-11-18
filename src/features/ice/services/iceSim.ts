import type { GameTunables } from "@/shared/types/gameTunables.types";
import { advanceFront, createSampleFront, queueArrival } from "@/shared/utils/sampleFront";
import {
  bodyGrids,
  getCellInfo,
  isFrozenSample,
  setSampleFrozen,
  type TerrainGrid,
} from "@/features/arena/api/arenaApi";
import type { ColdFeed, GroundIce, IceState } from "@/features/ice/types/ice.types";

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
 *
 * Every body of the arena freezes on its own field (mover-materials lap 2b): the static terrain
 * and each moving part, in the arena's `bodyGrids` order. The cold stays inside the body the
 * beam touches; a part's ice rides with the part.
 */
const createGroundIce = (grid: TerrainGrid): GroundIce => ({
  thawAt: new Float32Array(grid.widthCells * grid.heightCells),
  frozen: [],
  frozenDue: [],
  frozenHead: 0,
  thawed: 0,
});

export function createIceState(terrain: TerrainGrid): IceState {
  return {
    feeds: new Map(),
    grounds: bodyGrids(terrain).map(createGroundIce),
    rays: [],
    blobs: new Map(),
    blobGraceUntil: new Map(),
    blobMoments: [],
    frozeCounts: {},
    crackCounts: {},
    shatterCounts: {},
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
  return info?.reactions.cold === "freezes";
};

/** Terrain the cold can freeze: ground it travels through that is not frozen yet. */
export const canFreeze = (grid: TerrainGrid, index: number): boolean =>
  carriesCold(grid, index) && !isFrozenSample(grid, index);

/** Most bodies a level has (the static terrain and 16 parts), rounded up: the feed key's base. */
const BODY_KEY_BASE = 64;

/** One feed per ray and body: a ray that moves from the ground to a part starts a new patch. */
const feedKey = (slot: number, body: number): number => slot * BODY_KEY_BASE + body;

function feedOf(ice: IceState, grid: TerrainGrid, key: number): ColdFeed {
  const known = ice.feeds.get(key);
  if (known) return known;
  const feed: ColdFeed = {
    front: createSampleFront(grid.widthCells * grid.heightCells),
    seedKey: -1,
    budget: 0,
    fedAt: -Infinity,
  };
  ice.feeds.set(key, feed);
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

function freeze(ground: GroundIce, grid: TerrainGrid, at: { index: number; due: number }): void {
  if (!setSampleFrozen(grid, at.index, true)) return;
  ground.thawAt[at.index] = at.due;
  ground.frozen.push(at.index);
  ground.frozenDue.push(at.due);
}

export interface ColdStep {
  /** The player slot whose ray this is. */
  slot: number;
  /** The body the samples are on (0 = the static terrain, the default). */
  body?: number;
  /** Samples of that body the ray's beams ended on this step. */
  samples: readonly number[];
  /** The part of this step's ice that goes to this body (a ray split over bodies); 1 when left out. */
  share?: number;
  /** Sim time of this step and its length, seconds. */
  now: number;
  dt: number;
  tunables: GameTunables;
}

/** World area of ice this step makes on the body it feeds. */
const stepIceArea = (step: ColdStep): number =>
  step.tunables.ice.freezeAreaPerSecond * step.dt * (step.share ?? 1);

/**
 * Marks a feed as fed this step. A beam that moved, or came back after a pause, counts its
 * distances from where it touches now; after a pause the unspent ice is dropped.
 */
function fedThisStep(feed: ColdFeed, touched: readonly number[], step: ColdStep): ColdFeed {
  const key = Math.min(...touched);
  const paused = step.now - feed.fedAt > step.dt * 1.5;
  if (paused) feed.budget = 0;
  if (paused || feed.seedKey !== key) reseed(feed, touched, key);
  feed.fedAt = step.now;
  return feed;
}

/**
 * One step of a freeze ray on the ground: adds this step's ice to the ray's budget and places
 * it, nearest unfrozen ground first, on the body the beam touches. A beam on air or on ice
 * terrain makes nothing.
 */
export function feedCold(ice: IceState, terrain: TerrainGrid, step: ColdStep): void {
  const body = step.body ?? 0;
  const grid = bodyGrids(terrain)[body];
  const ground = ice.grounds[body];
  if (!grid || !ground) return;
  const touched = step.samples.filter((index) => carriesCold(grid, index));
  if (touched.length === 0) return;
  const { frozenSeconds } = step.tunables.ice;
  const feed = fedThisStep(feedOf(ice, grid, feedKey(step.slot, body)), touched, step);
  feed.budget += stepIceArea(step) / (grid.cellSize * grid.cellSize);
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
      freeze(ground, grid, { index, due });
    },
  });
  // Nothing left to freeze within reach: the unspent ice is not saved up.
  if (feed.front.heapIndex.length === 0) feed.budget = Math.min(feed.budget, 1);
}

/** Thaws one body's samples whose frozen time is over, oldest first. */
function thawDue(ground: GroundIce, grid: TerrainGrid, now: number): void {
  while (ground.frozenHead < ground.frozen.length) {
    const index = ground.frozen[ground.frozenHead]!;
    const due = ground.frozenDue[ground.frozenHead]!;
    if (due > now) break;
    ground.frozenHead += 1;
    ground.thawed += 1;
    // Stale: frozen again since (its later entry thaws it).
    if (ground.thawAt[index] !== due) continue;
    ground.thawAt[index] = 0;
    setSampleFrozen(grid, index, false);
  }
  if (ground.frozenHead > 1024 && ground.frozenHead * 2 > ground.frozen.length) {
    ground.frozen = ground.frozen.slice(ground.frozenHead);
    ground.frozenDue = ground.frozenDue.slice(ground.frozenHead);
    ground.frozenHead = 0;
  }
}

/** How many samples have thawed by themselves so far, over all bodies (the thaw sound). */
export const thawedCount = (ice: IceState): number =>
  ice.grounds.reduce((sum, ground) => sum + ground.thawed, 0);

/** Advances the ice to sim time `now` (after this step's freeze rays): what is due thaws. */
export function stepIce(ice: IceState, terrain: TerrainGrid, frame: { now: number }): void {
  // Beams not renewed this step have stopped (the ray is held before this step runs).
  ice.rays = ice.rays.filter((beam) => beam.atSeconds >= frame.now);
  bodyGrids(terrain).forEach((grid, body) => {
    const ground = ice.grounds[body];
    if (ground) thawDue(ground, grid, frame.now);
  });
}
