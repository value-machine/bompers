import type { Vec2 } from "@/shared/types/gameGeometry.types";
import { rowRunSlabs, type BlockSlab, type GridBlock } from "@/shared/utils/blockSlabs";
import type { FreezeRayBeam } from "@/features/ice/types/ice.types";

/**
 * Ice geometry: pure shapes the ice renderer fills. Frozen ground is drawn the way a fire's body
 * is (owner, ice-element D4: "the same shape as a burning shape could also be a frozen shape"):
 * the frozen samples in 2 × 2 blocks, one slab per row run of blocks, so a frozen patch of any
 * size costs a slab per row run. On top of that: a lighter lip where the block above is not
 * frozen ground, and a few gloss streaks at fixed places, the slippery cue of DESIGN_LANGUAGE § 2.
 * The freeze ray is "Cold breath" (owner, ice-element D9): the torch's twin in ice colours, a
 * thin neck that billows into a rolling cloud where it lands, with snow specks drifting down.
 */
export const ICE_LOOK = {
  /** Corner radius of a body slab, in blocks. */
  bodyRadius: 0.2,
  /** How far a body slab overlaps its neighbours, in blocks (hides the seams between rows). */
  bodyGrow: 0.04,
  /** Height of the lip on a top edge, in blocks. */
  lipHeight: 0.4,
  /** One block in this many carries a gloss streak. */
  glossEvery: 9,
  breath: {
    /** Where the breath leaves the emitter: units along the aim from the helmet point. */
    emitterReach: 15,
    /** Seconds to grow in, and for the head to let go after release (juice windows, as the torch). */
    growSeconds: 0.12,
    releaseSeconds: 0.3,
    /** Half-width of the neck at the emitter, and what it adds by the head, world units. */
    neckStart: 1.4,
    neckFlare: 5.5,
    /** How far the neck's upper side lifts by the head, world units (cold mist billows up a bit). */
    neckLift: 3,
    /** Where the head sits along the breath (0 emitter … 1 end). */
    headAt: 0.93,
    /** The head's lobes: how many, their radius, the ring they roll on, turns per second. */
    lobes: 6,
    lobeRadius: 6.5,
    lobeRing: 5.5,
    rollHz: 0.4,
    /** How much wider than the neck's end the head's round heart is, world units. */
    heartMargin: 3,
    /** The lighter inside as a share of the outer shape. */
    innerShare: 0.55,
    /** Snow specks: how many, how far they fall, their radius, falls per second. */
    specks: 6,
    speckFall: 22,
    speckRadius: 1.5,
    speckHz: 0.7,
  },
} as const;

export interface FrozenShapes {
  body: BlockSlab[];
  lip: BlockSlab[];
  /** Gloss streaks: a short 45° line each, from `a` to `b`. */
  gloss: { a: Vec2; b: Vec2 }[];
}

/** The frozen blocks (by `by * stride + bx`) as body slabs, top-edge lips and gloss streaks. */
export function frozenShapes(
  blocks: ReadonlyMap<number, GridBlock>,
  look: { size: number; stride: number }
): FrozenShapes {
  const { size, stride } = look;
  const all = [...blocks.values()];
  const has = (bx: number, by: number): boolean =>
    bx >= 0 && by >= 0 && blocks.has(by * stride + bx);
  const tops = all.filter((block) => !has(block.bx, block.by - 1));
  const lip = rowRunSlabs(tops, { size, grow: 0 }).map((slab) => ({
    ...slab,
    h: ICE_LOOK.lipHeight * size,
  }));
  // Only blocks inside the patch carry gloss, so a streak never pokes out of the frozen shape.
  const glossy = all.filter(
    (block) =>
      (block.bx * 7 + block.by * 13) % ICE_LOOK.glossEvery === 0 &&
      has(block.bx - 1, block.by) &&
      has(block.bx + 1, block.by) &&
      has(block.bx, block.by - 1) &&
      has(block.bx, block.by + 1)
  );
  const gloss = glossy.map((block) => ({
    a: { x: (block.bx + 0.85) * size, y: (block.by + 0.1) * size },
    b: { x: (block.bx + 0.15) * size, y: (block.by + 0.9) * size },
  }));
  return { body: rowRunSlabs(all, { size, grow: ICE_LOOK.bodyGrow * size }), lip, gloss };
}

export interface Disc {
  x: number;
  y: number;
  r: number;
}

/** One freeze ray as a cold breath: a neck (outer and lighter inside), a rolling head, specks. */
export interface BreathShape {
  /** The neck's outline: from the emitter out along the upper side and back along the lower. */
  neck: number[];
  /** The lighter inside of the neck. */
  neckInner: number[];
  /** The head: a round heart that covers the neck's end, then the lobes rolling around it. */
  lobes: Disc[];
  /** Snow specks drifting down under the breath. */
  specks: Disc[];
  /** Centre and radius of the head, kept for the release puff. */
  head: Vec2;
  headRadius: number;
}

const TAU = Math.PI * 2;
const NECK_STEPS = 10;

/** The breath's frame: emitter point, unit aim and normal, and its length to the middle ray's end. */
function breathFrame(beam: FreezeRayBeam, grow: number) {
  const look = ICE_LOOK.breath;
  const first = beam.ends[0] ?? beam.origin;
  const last = beam.ends[beam.ends.length - 1] ?? beam.origin;
  const mid = { x: (first.x + last.x) / 2, y: (first.y + last.y) / 2 };
  const full = Math.hypot(mid.x - beam.origin.x, mid.y - beam.origin.y) || 1;
  const aim = { x: (mid.x - beam.origin.x) / full, y: (mid.y - beam.origin.y) / full };
  const reach = Math.min(look.emitterReach, full * 0.5);
  const start = { x: beam.origin.x + aim.x * reach, y: beam.origin.y + aim.y * reach };
  // The upper side is the normal that points up on screen (y down), whichever way the aim goes.
  const side = aim.x >= 0 ? 1 : -1;
  const up = { x: aim.y * side, y: -aim.x * side };
  return { start, aim, up, length: (full - reach) * Math.min(1, Math.max(0, grow)) };
}

type BreathFrame = ReturnType<typeof breathFrame>;

/** A point `d` (0 … 1) along the breath, `lift` world units toward its upper side. */
const breathPoint = (f: BreathFrame, d: number, lift: number): Vec2 => ({
  x: f.start.x + f.aim.x * f.length * d + f.up.x * lift,
  y: f.start.y + f.aim.y * f.length * d + f.up.y * lift,
});

/** The neck as a polygon: thin at the emitter, flaring and lifting toward the head. */
function neckPolygon(f: BreathFrame, share: number): number[] {
  const look = ICE_LOOK.breath;
  const half = (d: number): number => (look.neckStart + look.neckFlare * d * d) * share;
  const steps = Array.from({ length: NECK_STEPS + 1 }, (_, i) => (i / NECK_STEPS) * look.headAt);
  const upper = steps.map((d) => breathPoint(f, d, half(d) + look.neckLift * d * d));
  const lower = steps.map((d) => breathPoint(f, d, -half(d) + look.neckLift * d * d)).reverse();
  return [...upper, ...lower].flatMap((p) => [p.x, p.y]);
}

/**
 * One freeze ray as a cold breath. `grow` (0 … 1) is how far it has grown in since it started.
 * It follows the middle ray the sim cast, so it lands where the ice does.
 */
export function breathShape(
  beam: FreezeRayBeam,
  at: { timeSeconds: number; grow: number }
): BreathShape {
  const look = ICE_LOOK.breath;
  const f = breathFrame(beam, at.grow);
  const head = breathPoint(f, look.headAt, look.neckLift * look.headAt * look.headAt);
  const scale = Math.min(1, Math.max(0.2, at.grow));
  const turn = at.timeSeconds * TAU * look.rollHz + beam.slot;
  const rolling = Array.from({ length: look.lobes }, (_, i) => {
    const a = turn + (i * TAU) / look.lobes;
    const pulse = 1 + 0.15 * Math.sin(at.timeSeconds * 5 + i * 2);
    return {
      x: head.x + Math.cos(a) * look.lobeRing * scale,
      y: head.y + Math.sin(a) * look.lobeRing * 0.7 * scale,
      r: look.lobeRadius * scale * pulse,
    };
  });
  // A round heart behind the lobes, wider than the neck's end: the neck's square end and its
  // corners always sit inside the cloud, whatever the lobes are doing (owner, 2026-11-18).
  const neckEnd = look.neckStart + look.neckFlare * look.headAt * look.headAt;
  const heart = { x: head.x, y: head.y, r: (neckEnd + look.heartMargin) * scale };
  const lobes = [heart, ...rolling];
  const specks = Array.from({ length: look.specks }, (_, i) => {
    const fall = (at.timeSeconds * look.speckHz + i / look.specks) % 1;
    const p = breathPoint(f, 0.3 + (0.6 * i) / look.specks, 0);
    return {
      x: p.x + Math.sin(i * 3 + at.timeSeconds * 2) * 2,
      y: p.y + 3 + fall * look.speckFall,
      r: look.speckRadius * (1 - fall) + 0.3,
    };
  });
  return {
    neck: neckPolygon(f, 1),
    neckInner: neckPolygon(f, look.innerShare),
    lobes,
    specks,
    head,
    headRadius: (look.lobeRing + look.lobeRadius) * scale,
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
