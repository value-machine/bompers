import type { GameTunables } from "@/shared/types/gameTunables.types";
import {
  EMPTY_CELL,
  burnOut,
  type ClearedCells,
  type TerrainGrid,
} from "@/features/arena/api/arenaApi";
import type { FireState } from "@/features/fire/types/fire.types";

/**
 * Fire on the terrain field (fire-spread b1; owner rules blast-power D5, D6, D18): fire is an
 * arrival time per sample. A lit sample lights each touching fuel sample at its own time plus
 * the step length over `fire.spreadSpeed`, so the front runs outward at the same speed every
 * way through solid fuel and never crosses air (D9: a diagonal step needs a solid sample beside
 * it). Fuel = a `burns` material; fuel with a `douses` sample among its 8 neighbours never
 * catches. Breakable non-fuel next to fire (earth) is scorched and stops it; stone just blocks.
 * A lit sample burns `fire.burnSeconds`, then is removed with the next batch every
 * `fire.burnOutInterval` (one terrain write and one effect per batch).
 */
export function createFireState(grid: TerrainGrid): FireState {
  const count = grid.widthCells * grid.heightCells;
  return {
    igniteAt: new Float32Array(count).fill(Infinity),
    heapIndex: [],
    heapTime: [],
    lit: [],
    litHead: 0,
    dueOut: [],
    nextBurnOutAt: 0,
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

// ── Min-heap of pending ignitions (time, then index) ──────────────────────────

const before = (fire: FireState, a: number, b: number): boolean => {
  const ta = fire.heapTime[a]!;
  const tb = fire.heapTime[b]!;
  return ta < tb || (ta === tb && fire.heapIndex[a]! < fire.heapIndex[b]!);
};

function swap(fire: FireState, a: number, b: number): void {
  [fire.heapIndex[a], fire.heapIndex[b]] = [fire.heapIndex[b]!, fire.heapIndex[a]!];
  [fire.heapTime[a], fire.heapTime[b]] = [fire.heapTime[b]!, fire.heapTime[a]!];
}

function heapPush(fire: FireState, index: number, time: number): void {
  fire.heapIndex.push(index);
  fire.heapTime.push(time);
  let at = fire.heapIndex.length - 1;
  while (at > 0) {
    const parent = (at - 1) >> 1;
    if (!before(fire, at, parent)) return;
    swap(fire, at, parent);
    at = parent;
  }
}

function heapPop(fire: FireState): void {
  const last = fire.heapIndex.length - 1;
  swap(fire, 0, last);
  fire.heapIndex.pop();
  fire.heapTime.pop();
  let at = 0;
  for (;;) {
    const left = at * 2 + 1;
    const right = left + 1;
    let first = at;
    if (left < last && before(fire, left, first)) first = left;
    if (right < last && before(fire, right, first)) first = right;
    if (first === at) return;
    swap(fire, at, first);
    at = first;
  }
}

// ── Fuel ─────────────────────────────────────────────────────────────────────

const NEIGHBOURS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
] as const;

const slotAt = (grid: TerrainGrid, cx: number, cy: number) => {
  if (cx < 0 || cy < 0 || cx >= grid.widthCells || cy >= grid.heightCells) return null;
  const slot = grid.cells[cy * grid.widthCells + cx] ?? EMPTY_CELL;
  return slot === EMPTY_CELL ? null : (grid.slots[slot] ?? null);
};

/** Fuel that can catch: a `burns` sample with no `douses` sample among its 8 neighbours (D5). */
export function canBurn(grid: TerrainGrid, index: number): boolean {
  const cx = index % grid.widthCells;
  const cy = Math.floor(index / grid.widthCells);
  if (!slotAt(grid, cx, cy)?.burns) return false;
  return NEIGHBOURS.every(([dx, dy]) => slotAt(grid, cx + dx, cy + dy)?.douses !== true);
}

/** Sets a sample to catch at `time` if that is sooner than it would; false when it can't burn. */
export function ignite(
  fire: FireState,
  grid: TerrainGrid,
  at: { index: number; time: number }
): boolean {
  // Stored as 32-bit floats; the heap keeps the same rounded value so stale entries are exact.
  const time = Math.fround(at.time);
  if (!canBurn(grid, at.index) || (fire.igniteAt[at.index] ?? 0) <= time) return false;
  fire.igniteAt[at.index] = time;
  heapPush(fire, at.index, time);
  return true;
}

// ── Spread ───────────────────────────────────────────────────────────────────

interface SpreadPass {
  fire: FireState;
  grid: TerrainGrid;
  /** Seconds per world unit of front travel. */
  pace: number;
}

/** A diagonal step passes only beside a solid sample, never through a corner of air (D9). */
const stepTouches = (
  grid: TerrainGrid,
  step: { cx: number; cy: number; dx: number; dy: number }
): boolean =>
  step.dx === 0 ||
  step.dy === 0 ||
  slotAt(grid, step.cx + step.dx, step.cy) !== null ||
  slotAt(grid, step.cx, step.cy + step.dy) !== null;

/** Lights `index` at `time`: queues its touching fuel and scorches touching breakable non-fuel. */
function light(pass: SpreadPass, index: number, time: number): void {
  const { fire, grid } = pass;
  fire.lit.push(index);
  fire.version += 1;
  const from = { cx: index % grid.widthCells, cy: Math.floor(index / grid.widthCells) };
  for (const [dx, dy] of NEIGHBOURS) {
    const info = slotAt(grid, from.cx + dx, from.cy + dy);
    if (!info || !stepTouches(grid, { ...from, dx, dy })) continue;
    const next = (from.cy + dy) * grid.widthCells + from.cx + dx;
    if (!info.burns && info.toughness !== null) markScorched(fire, next);
    const step = dx !== 0 && dy !== 0 ? Math.SQRT2 : 1;
    ignite(fire, grid, { index: next, time: time + step * grid.cellSize * pass.pace });
  }
}

function markScorched(fire: FireState, index: number): void {
  if (fire.scorched[index] === 1) return;
  fire.scorched[index] = 1;
  fire.version += 1;
}

/** Lights every pending ignition due by `now`, in time order (stale and burnt-away ones skip). */
function spread(pass: SpreadPass, now: number): void {
  const { fire, grid } = pass;
  while (fire.heapIndex.length > 0 && fire.heapTime[0]! <= now) {
    const index = fire.heapIndex[0]!;
    const time = fire.heapTime[0]!;
    heapPop(fire);
    if (fire.igniteAt[index] !== time) continue;
    if (!canBurn(grid, index)) continue;
    light(pass, index, time);
  }
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

/**
 * Advances fire to sim time `now`: lights what the front has reached, then, on the batch beat,
 * removes what has burnt out. Returns what was removed this step (for effects / sound), or null.
 */
export function stepFire(
  fire: FireState,
  grid: TerrainGrid,
  frame: { now: number; tunables: GameTunables }
): ClearedCells | null {
  const { spreadSpeed, burnSeconds, burnOutInterval } = frame.tunables.fire;
  // Sprays not renewed this step have stopped (the torch sprays before this step runs).
  fire.sprays = fire.sprays.filter((spray) => spray.atSeconds >= frame.now);
  spread({ fire, grid, pace: 1 / spreadSpeed }, frame.now);
  collectBurnt(fire, burnSeconds, frame.now);
  if (frame.now < fire.nextBurnOutAt || fire.dueOut.length === 0) return null;
  fire.nextBurnOutAt = frame.now + burnOutInterval;
  const cleared = burnOut(grid, fire.dueOut);
  fire.dueOut = [];
  fire.version += 1;
  return cleared.removed > 0 ? cleared : null;
}
