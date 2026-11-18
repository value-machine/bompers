import type { GameTunables } from "@/shared/types/gameTunables.types";
import {
  advanceFront,
  clearArrival,
  createSampleFront,
  queueArrival,
} from "@/shared/utils/sampleFront";
import {
  getCellInfo,
  isFrozenSample,
  setSampleFrozen,
  type TerrainGrid,
} from "@/features/arena/api/arenaApi";
import type { IceState } from "@/features/ice/types/ice.types";

/**
 * Frozen ground on the terrain field (owner, ice-element D1–D6): the same system as fire with
 * another meaning. The cold is an arrival time per sample, spread by the shared sample front
 * through touching terrain of any material at `ice.spreadSpeed`, the same every way and never
 * across air. Unlike fire it does not feed itself: the front's clock is the time freeze rays have
 * fed it, so the ice grows only while a ray is on terrain and stops where it is when the ray lets
 * go. A reached sample is frozen (the arena's flag: slippery, not cut by blasts, closed to fire)
 * for `ice.frozenSeconds`, then thaws by itself; the torch can thaw it sooner. Ice terrain itself
 * is never entered: it is what the rest turns into.
 */
export function createIceState(grid: TerrainGrid): IceState {
  const count = grid.widthCells * grid.heightCells;
  return {
    front: createSampleFront(count),
    fedSeconds: 0,
    fedAt: -Infinity,
    thawAt: new Float32Array(count),
    frozen: [],
    frozenDue: [],
    frozenHead: 0,
    frozenSeen: grid.frozenVersion,
    rays: [],
  };
}

/** Terrain the cold can enter: solid, not ice already, and not frozen. */
export function canFreeze(grid: TerrainGrid, index: number): boolean {
  const info = getCellInfo(grid, index % grid.widthCells, Math.floor(index / grid.widthCells));
  return info !== null && !info.douses && !isFrozenSample(grid, index);
}

/**
 * A freeze ray touches a sample at sim time `now`: the sample is due to freeze at once (when it
 * can), and the front is fed for this step whether or not the sample was frozen already.
 */
export function feedCold(
  ice: IceState,
  grid: TerrainGrid,
  at: { index: number; now: number }
): void {
  ice.fedAt = at.now;
  if (canFreeze(grid, at.index)) queueArrival(ice.front, at.index, ice.fedSeconds);
}

/** Freezes every sample the front reaches by its clock. */
function spread(ice: IceState, grid: TerrainGrid, frame: { now: number; tunables: GameTunables }) {
  const { spreadSpeed, frozenSeconds } = frame.tunables.ice;
  advanceFront(ice.front, grid, {
    now: ice.fedSeconds,
    pace: 1 / spreadSpeed,
    canEnter: (index) => canFreeze(grid, index),
    onArrive: (index) => {
      // Stored as a 32-bit float; the queue keeps the same rounded value so stale entries show.
      const due = Math.fround(frame.now + frozenSeconds);
      setSampleFrozen(grid, index, true);
      ice.thawAt[index] = due;
      ice.frozen.push(index);
      ice.frozenDue.push(due);
    },
  });
}

/** A sample no longer frozen can be reached by the front again. */
function release(ice: IceState, index: number): void {
  ice.thawAt[index] = 0;
  clearArrival(ice.front, index);
}

/**
 * Samples something else thawed or removed since the last step (the torch, a burn-out) lose
 * their place in this state, so they can freeze again. Runs only when the terrain's frozen
 * flags changed behind this state's back.
 */
function dropThawedElsewhere(ice: IceState, grid: TerrainGrid): void {
  if (ice.frozenSeen === grid.frozenVersion) return;
  for (let i = ice.frozenHead; i < ice.frozen.length; i += 1) {
    const index = ice.frozen[i]!;
    if (ice.thawAt[index] !== 0 && !isFrozenSample(grid, index)) release(ice, index);
  }
}

/** Thaws the samples whose frozen time is over, oldest first. */
function thawDue(ice: IceState, grid: TerrainGrid, now: number): void {
  while (ice.frozenHead < ice.frozen.length) {
    const index = ice.frozen[ice.frozenHead]!;
    const due = ice.frozenDue[ice.frozenHead]!;
    if (due > now) break;
    ice.frozenHead += 1;
    // Stale: thawed elsewhere since, or frozen again (its later entry thaws it).
    if (ice.thawAt[index] !== due) continue;
    setSampleFrozen(grid, index, false);
    release(ice, index);
  }
  if (ice.frozenHead > 1024 && ice.frozenHead * 2 > ice.frozen.length) {
    ice.frozen = ice.frozen.slice(ice.frozenHead);
    ice.frozenDue = ice.frozenDue.slice(ice.frozenHead);
    ice.frozenHead = 0;
  }
}

/**
 * Advances the ice to sim time `now` (after this step's freeze rays): when a ray fed it this
 * step the front's clock runs `dt` and the cold spreads; frozen samples whose time is over thaw.
 */
export function stepIce(
  ice: IceState,
  grid: TerrainGrid,
  frame: { now: number; dt: number; tunables: GameTunables }
): void {
  // Beams not renewed this step have stopped (the ray is held before this step runs).
  ice.rays = ice.rays.filter((beam) => beam.atSeconds >= frame.now);
  dropThawedElsewhere(ice, grid);
  if (ice.fedAt >= frame.now) {
    ice.fedSeconds += frame.dt;
    spread(ice, grid, frame);
  }
  thawDue(ice, grid, frame.now);
  ice.frozenSeen = grid.frozenVersion;
}
