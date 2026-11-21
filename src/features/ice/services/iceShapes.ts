import type { Vec2 } from "@/shared/types/gameGeometry.types";
import type { FreezeRayBeam } from "@/features/ice/types/ice.types";

/**
 * Ice geometry: pure shapes the ice renderer fills. Frozen ground itself is drawn by the renderer
 * as the terrain's contour limited to the frozen samples, the way a fire's body is (owner,
 * ice-element D4: "the same shape as a burning shape could also be a frozen shape";
 * element-overlay-shape D1). Here: the gloss streaks on it, at fixed places, the slippery cue of
 * DESIGN_LANGUAGE § 2.
 * The freeze ray is "Cold breath" (owner, ice-element D9) drawn as the "Frost fan" (owner,
 * freeze-ray-spread D1): one wide spray from the emitter whose edge runs through every ray's own
 * end, a frost puff where each ray lands, and snow specks drifting down.
 */
export const ICE_LOOK = {
  /** One block in this many carries a gloss streak. */
  glossEvery: 9,
  breath: {
    /**
     * Where the breath leaves the emitter: units along the aim from the helmet point, at the knob
     * in front of the freeze ray's dish (`weaponTube` shape `dish`, 50 mockup units at u ≈ 0.41).
     */
    emitterReach: 20,
    /** Seconds to grow in, and for the head to let go after release (juice windows, as the torch). */
    growSeconds: 0.12,
    releaseSeconds: 0.3,
    /** Half-width of the spray at the emitter, world units. */
    neckStart: 1.4,
    /** The lighter inside: how far toward each ray's end it reaches, and its width at the emitter. */
    innerShare: 0.55,
    innerReach: 0.8,
    /**
     * The frost puff at each ray's end: a round heart (it rounds the fan's corner there), plus
     * `puffLobes` lobes rolling on a ring where the ray lands on something; turns per second.
     */
    puffRadius: 4.5,
    puffLobes: 3,
    puffRing: 3,
    lobeRadius: 3.2,
    rollHz: 0.4,
    /** Snow specks: how many, how far they fall, their radius, falls per second. */
    specks: 6,
    speckFall: 22,
    speckRadius: 1.5,
    speckHz: 0.7,
  },
} as const;

/** A 2 × 2 block of samples by block column and row. */
export interface GridBlock {
  bx: number;
  by: number;
}

/** A gloss streak: a short 45° line from `a` to `b`. */
export interface GlossStreak {
  a: Vec2;
  b: Vec2;
}

/**
 * Gloss streaks on the frozen blocks (by `by * stride + bx`): one block in `glossEvery`, and
 * only blocks with frozen ground all round, so a streak never pokes out of the frozen shape.
 */
export function frostGloss(
  blocks: ReadonlyMap<number, GridBlock>,
  look: { size: number; stride: number }
): GlossStreak[] {
  const { size, stride } = look;
  const has = (bx: number, by: number): boolean =>
    bx >= 0 && by >= 0 && blocks.has(by * stride + bx);
  const glossy = [...blocks.values()].filter(
    (block) =>
      (block.bx * 7 + block.by * 13) % ICE_LOOK.glossEvery === 0 &&
      has(block.bx - 1, block.by) &&
      has(block.bx + 1, block.by) &&
      has(block.bx, block.by - 1) &&
      has(block.bx, block.by + 1)
  );
  return glossy.map((block) => ({
    a: { x: (block.bx + 0.85) * size, y: (block.by + 0.1) * size },
    b: { x: (block.bx + 0.15) * size, y: (block.by + 0.9) * size },
  }));
}

export interface Disc {
  x: number;
  y: number;
  r: number;
}

/** One freeze ray as a frost fan: the spray (outer and lighter inside), frost puffs, specks. */
export interface BreathShape {
  /** The spray's outline: from the emitter out through every ray's end and back. */
  neck: number[];
  /** The lighter inside of the spray. */
  neckInner: number[];
  /** The frost puffs: a heart at every ray's end, and rolling lobes where a ray lands. */
  lobes: Disc[];
  /** Snow specks drifting down under the spray. */
  specks: Disc[];
  /** End and puff radius of the middle ray, kept for the release puff. */
  head: Vec2;
  headRadius: number;
}

const TAU = Math.PI * 2;

/** The spray's frame: emitter point, the unit aim of the middle ray, each ray's grown end. */
function breathFrame(beam: FreezeRayBeam, grow: number) {
  const look = ICE_LOOK.breath;
  const middle = beam.ends[Math.floor(beam.ends.length / 2)] ?? beam.origin;
  const full = Math.hypot(middle.x - beam.origin.x, middle.y - beam.origin.y) || 1;
  const aim = { x: (middle.x - beam.origin.x) / full, y: (middle.y - beam.origin.y) / full };
  const reach = Math.min(look.emitterReach, full * 0.5);
  const start = { x: beam.origin.x + aim.x * reach, y: beam.origin.y + aim.y * reach };
  const k = Math.min(1, Math.max(0, grow));
  // A ray that ends before the emitter (a wall at the dish) ends at the emitter.
  const ends = beam.ends.map((end) => {
    const along = (end.x - start.x) * aim.x + (end.y - start.y) * aim.y;
    if (along <= 0) return start;
    return { x: start.x + (end.x - start.x) * k, y: start.y + (end.y - start.y) * k };
  });
  return { start, aim, ends, middle: Math.floor(beam.ends.length / 2) };
}

type BreathFrame = ReturnType<typeof breathFrame>;

/** The spray as a polygon: `width` either side of the emitter, out through each ray's end. */
function sprayPolygon(f: BreathFrame, look: { width: number; reach: number }): number[] {
  const n = { x: -f.aim.y, y: f.aim.x };
  const at = (end: Vec2): Vec2 => ({
    x: f.start.x + (end.x - f.start.x) * look.reach,
    y: f.start.y + (end.y - f.start.y) * look.reach,
  });
  const points = [
    { x: f.start.x - n.x * look.width, y: f.start.y - n.y * look.width },
    ...f.ends.map(at),
    { x: f.start.x + n.x * look.width, y: f.start.y + n.y * look.width },
  ];
  return points.flatMap((p) => [p.x, p.y]);
}

/** The frost puff at one ray's end: its heart, and rolling lobes when the ray landed. */
function puffAt(end: Vec2, opts: { landed: boolean; scale: number; turn: number; i: number }) {
  const look = ICE_LOOK.breath;
  const heart = { x: end.x, y: end.y, r: look.puffRadius * opts.scale };
  if (!opts.landed) return [heart];
  const lobes = Array.from({ length: look.puffLobes }, (_, j) => {
    const a = opts.turn + opts.i * 1.7 + (j * TAU) / look.puffLobes;
    return {
      x: end.x + Math.cos(a) * look.puffRing * opts.scale,
      y: end.y + Math.sin(a) * look.puffRing * 0.7 * opts.scale,
      r: look.lobeRadius * opts.scale,
    };
  });
  return [heart, ...lobes];
}

/**
 * One freeze ray as a frost fan. `grow` (0 … 1) is how far it has grown in since it started.
 * Every ray the sim cast is drawn to its own end, so the spray lands where the ice does.
 */
export function breathShape(
  beam: FreezeRayBeam,
  at: { timeSeconds: number; grow: number }
): BreathShape {
  const look = ICE_LOOK.breath;
  const f = breathFrame(beam, at.grow);
  const scale = Math.min(1, Math.max(0.2, at.grow));
  const turn = at.timeSeconds * TAU * look.rollHz + beam.slot;
  const lobes = f.ends.flatMap((end, i) =>
    puffAt(end, { landed: beam.touched[i] ?? false, scale, turn, i })
  );
  const head = f.ends[f.middle] ?? f.start;
  const specks = Array.from({ length: look.specks }, (_, i) => {
    const fall = (at.timeSeconds * look.speckHz + i / look.specks) % 1;
    const d = 0.3 + (0.6 * i) / look.specks;
    const p = { x: f.start.x + (head.x - f.start.x) * d, y: f.start.y + (head.y - f.start.y) * d };
    return {
      x: p.x + Math.sin(i * 3 + at.timeSeconds * 2) * 2,
      y: p.y + 3 + fall * look.speckFall,
      r: look.speckRadius * (1 - fall) + 0.3,
    };
  });
  return {
    neck: sprayPolygon(f, { width: look.neckStart, reach: 1 }),
    neckInner: sprayPolygon(f, { width: look.neckStart * look.innerShare, reach: look.innerReach }),
    lobes,
    specks,
    head,
    headRadius: (look.puffRing + look.puffRadius) * scale,
  };
}

/** The head of a breath that just stopped: a few puffs that rise and shrink over `k` (0 … 1). */
export function breathRelease(last: { head: Vec2; radius: number }, k: number): Disc[] {
  const fade = 1 - k;
  return [-1, 0, 1].map((side) => ({
    x: last.head.x + side * last.radius * 0.55 * (1 + 0.4 * k),
    y: last.head.y - last.radius * 0.9 * k - (side === 0 ? last.radius * 0.25 : 0),
    r: last.radius * (side === 0 ? 0.6 : 0.42) * fade,
  }));
}
