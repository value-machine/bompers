import type { SampleField, SampleFront } from "@/shared/types/sampleFront.types";

/**
 * A front that spreads through touching samples of a grid (blast-power D18: an arrival time per
 * sample on the terrain field). Each sample has the time the front reaches it; arriving at a
 * sample queues each touching solid sample at its own time plus the step length times the pace,
 * keeping the earliest, so the front runs outward at the same speed every way through solid
 * terrain and never crosses air. What the front means is the caller's: fire lights the samples it
 * reaches, the freeze ray freezes them (ice-element D4). The clock is the caller's too: a front
 * only moves when `advanceFront` is given a later `now`.
 */
export const createSampleFront = (sampleCount: number): SampleFront => ({
  arriveAt: new Float32Array(sampleCount).fill(Infinity),
  heapIndex: [],
  heapTime: [],
});

// ── Min-heap of pending arrivals (time, then index) ───────────────────────────

const before = (front: SampleFront, a: number, b: number): boolean => {
  const ta = front.heapTime[a]!;
  const tb = front.heapTime[b]!;
  return ta < tb || (ta === tb && front.heapIndex[a]! < front.heapIndex[b]!);
};

function swap(front: SampleFront, a: number, b: number): void {
  [front.heapIndex[a], front.heapIndex[b]] = [front.heapIndex[b]!, front.heapIndex[a]!];
  [front.heapTime[a], front.heapTime[b]] = [front.heapTime[b]!, front.heapTime[a]!];
}

function heapPush(front: SampleFront, index: number, time: number): void {
  front.heapIndex.push(index);
  front.heapTime.push(time);
  let at = front.heapIndex.length - 1;
  while (at > 0) {
    const parent = (at - 1) >> 1;
    if (!before(front, at, parent)) return;
    swap(front, at, parent);
    at = parent;
  }
}

function heapPop(front: SampleFront): void {
  const last = front.heapIndex.length - 1;
  swap(front, 0, last);
  front.heapIndex.pop();
  front.heapTime.pop();
  let at = 0;
  for (;;) {
    const left = at * 2 + 1;
    const right = left + 1;
    let first = at;
    if (left < last && before(front, left, first)) first = left;
    if (right < last && before(front, right, first)) first = right;
    if (first === at) return;
    swap(front, at, first);
    at = first;
  }
}

/** Sets a sample to be reached at `time` if that is sooner than it would be; false otherwise. */
export function queueArrival(front: SampleFront, index: number, time: number): boolean {
  // Stored as 32-bit floats; the heap keeps the same rounded value so stale entries are exact.
  const rounded = Math.fround(time);
  if ((front.arriveAt[index] ?? 0) <= rounded) return false;
  front.arriveAt[index] = rounded;
  heapPush(front, index, rounded);
  return true;
}

/** Forgets that the front reached a sample, so it can be reached again. */
export function clearArrival(front: SampleFront, index: number): void {
  front.arriveAt[index] = Infinity;
}

// ── Spread ───────────────────────────────────────────────────────────────────

/** The 8 samples around one. */
export const SAMPLE_NEIGHBOURS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
] as const;

const isSolid = (field: SampleField, cx: number, cy: number): boolean =>
  cx >= 0 &&
  cy >= 0 &&
  cx < field.widthCells &&
  cy < field.heightCells &&
  (field.cells[cy * field.widthCells + cx] ?? 0) !== 0;

/** A diagonal step passes only beside a solid sample, never through a corner of air. */
const stepTouches = (
  field: SampleField,
  step: { cx: number; cy: number; dx: number; dy: number }
): boolean =>
  step.dx === 0 ||
  step.dy === 0 ||
  isSolid(field, step.cx + step.dx, step.cy) ||
  isSolid(field, step.cx, step.cy + step.dy);

export interface FrontAdvance {
  /** The front's clock: every arrival due by it happens, in time order. */
  now: number;
  /** Seconds of that clock per world unit of travel. */
  pace: number;
  /** Whether the front may reach this sample (asked when it is queued and again when due). */
  canEnter: (index: number) => boolean;
  /** The front reached a sample. */
  onArrive: (index: number, time: number) => void;
  /**
   * Asked before each due arrival, nearest first: true stops the advance there and leaves that
   * arrival pending (a front that spends a budget instead of running to a clock).
   */
  until?: (index: number, time: number) => boolean;
  /** A solid sample touching a reached one that the front may not enter. */
  onBlocked?: (index: number) => void;
}

/** A reached sample queues its touching solid samples, each at its own time plus the step. */
function reach(
  front: SampleFront,
  field: SampleField,
  at: { index: number; time: number; advance: FrontAdvance }
): void {
  const { advance } = at;
  const from = { cx: at.index % field.widthCells, cy: Math.floor(at.index / field.widthCells) };
  for (const [dx, dy] of SAMPLE_NEIGHBOURS) {
    if (!isSolid(field, from.cx + dx, from.cy + dy)) continue;
    if (!stepTouches(field, { ...from, dx, dy })) continue;
    const next = (from.cy + dy) * field.widthCells + from.cx + dx;
    if (!advance.canEnter(next)) {
      advance.onBlocked?.(next);
      continue;
    }
    const step = dx !== 0 && dy !== 0 ? Math.SQRT2 : 1;
    queueArrival(front, next, at.time + step * field.cellSize * advance.pace);
  }
}

/** Moves the front to `advance.now`: every pending arrival due by then, stale ones skipped. */
export function advanceFront(front: SampleFront, field: SampleField, advance: FrontAdvance): void {
  while (front.heapIndex.length > 0 && front.heapTime[0]! <= advance.now) {
    const index = front.heapIndex[0]!;
    const time = front.heapTime[0]!;
    const stale = front.arriveAt[index] !== time;
    if (!stale && advance.until?.(index, time)) return;
    heapPop(front);
    if (stale) continue;
    if (!advance.canEnter(index)) {
      // Not reached after all (it froze while waiting, say): forget its time, so `arriveAt` holds
      // only samples the front really reached (fire-ice seam: damage read a fire never drawn).
      clearArrival(front, index);
      continue;
    }
    advance.onArrive(index, time);
    reach(front, field, { index, time, advance });
  }
}
