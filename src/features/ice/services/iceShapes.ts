import type { Vec2 } from "@/shared/types/gameGeometry.types";
import type { OutlineRing } from "@/shared/utils/contourRings";
import { inkStroke, outlineWidth } from "@/shared/utils/outlineWidth";
import { puffFieldRings } from "@/shared/utils/puffField";
import { sprayStream } from "@/shared/utils/sprayStream";
import type { FreezeRayBeam } from "@/features/ice/types/ice.types";

/**
 * Ice geometry: pure shapes the ice renderer fills. Frozen ground itself is drawn by the renderer
 * as the terrain's contour limited to the frozen samples, the way a fire's body is (owner,
 * ice-element D4: "the same shape as a burning shape could also be a frozen shape";
 * element-overlay-shape D1). Here: the gloss streaks on it, at fixed places, the slippery cue of
 * DESIGN_LANGUAGE § 2.
 * The freeze ray is "Cold breath" (owner, ice-element D9) drawn as the "Cloud shape" (owner,
 * freeze-ray-shape D1): mist puffs pour out along every ray the sim cast to that ray's own end
 * (`sprayStream`), growing as they travel, and burst where a ray lands; they melt into ONE shape
 * (`puffFieldRings`) whose outline morphs as they flow, drawn with the shared ink stroke.
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
    /** The merged shape: its grid, how far a puff's bump reaches, and the fill and inner levels. */
    field: { cell: 4, reach: 2 },
    fillLevel: 0.35,
    innerLevel: 1.3,
    /** The release puffs' lighter inside as a share of each puff. */
    releaseInner: 0.55,
    /** Where a ray lands: this many burst puffs of this radius rolling around its end. */
    burstPuffs: 5,
    burstRadius: 7,
    rollHz: 0.4,
    /** The mist puffs pouring along every ray (`sprayStream`). */
    // Dense (owner, freeze-ray-dense, 2026-11-22: "way denser"): 16 fat puffs per ray at a lower
    // fill level, so neighbours melt into one solid body instead of a chain of blobs.
    stream: { perRay: 16, speed: 110, startAt: 8, radius: 3.5, grow: 7, wobble: 3, rise: 4 },
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

/**
 * The ink line of the spray's outline at a camera zoom: the shared outline width of an effect
 * (`outlineWidth`, the role the ice, the torch and the effects use) in the shared ink stroke
 * (`inkStroke`), so the band is one width everywhere and follows the zoom clamp.
 */
export const breathStroke = (zoom: number): ReturnType<typeof inkStroke> =>
  inkStroke(outlineWidth("effect", zoom).width, "ice");

/** One freeze ray as a cloud shape: the merged mist's outline rings, its lighter inside, specks. */
export interface BreathShape {
  /** The edge of the whole spray at the fill level: filled with ice and stroked in ink. */
  outline: OutlineRing[];
  /** The lighter inside, a higher level of the same field (no stroke). */
  inner: OutlineRing[];
  /** Snow specks drifting down under the spray. */
  specks: Disc[];
  /** End of the middle ray and the burst radius there, kept for the release puff. */
  head: Vec2;
  headRadius: number;
}

const TAU = Math.PI * 2;

/** The spray's frame: emitter point and each ray's grown end. */
function breathFrame(beam: FreezeRayBeam, grow: number) {
  const look = ICE_LOOK.breath;
  const middle = Math.floor(beam.ends.length / 2);
  const mid = beam.ends[middle] ?? beam.origin;
  const full = Math.hypot(mid.x - beam.origin.x, mid.y - beam.origin.y) || 1;
  const aim = { x: (mid.x - beam.origin.x) / full, y: (mid.y - beam.origin.y) / full };
  const reach = Math.min(look.emitterReach, full * 0.5);
  const start = { x: beam.origin.x + aim.x * reach, y: beam.origin.y + aim.y * reach };
  const k = Math.min(1, Math.max(0, grow));
  // A ray that ends before the emitter (a wall at the dish) ends at the emitter.
  const ends = beam.ends.map((end) => {
    const along = (end.x - start.x) * aim.x + (end.y - start.y) * aim.y;
    if (along <= 0) return start;
    return { x: start.x + (end.x - start.x) * k, y: start.y + (end.y - start.y) * k };
  });
  return { start, ends, middle };
}

type BreathFrame = ReturnType<typeof breathFrame>;

/** Burst puffs rolling around the end of every ray that landed on something. */
function bursts(f: BreathFrame, beam: FreezeRayBeam, at: { t: number; scale: number }): Disc[] {
  const look = ICE_LOOK.breath;
  const turn = at.t * TAU * look.rollHz + beam.slot;
  return f.ends.flatMap((end, i) => {
    if (!beam.touched[i]) return [];
    return Array.from({ length: look.burstPuffs }, (_, j) => {
      const a = turn + i * 1.7 + (j * TAU) / look.burstPuffs;
      const r = look.burstRadius * at.scale;
      return {
        x: end.x + Math.cos(a) * r * 0.7,
        y: end.y + Math.sin(a) * r * 0.5 - r * 0.3,
        r: r * (0.75 + 0.2 * Math.sin(at.t * 5 + i + j)),
      };
    });
  });
}

/**
 * One freeze ray as a mist cloud. `grow` (0 … 1) is how far it has grown in since it started.
 * Every puff sits on a ray the sim cast, so the spray lands where the ice does.
 */
export function breathShape(
  beam: FreezeRayBeam,
  at: { timeSeconds: number; grow: number }
): BreathShape {
  const look = ICE_LOOK.breath;
  const t = at.timeSeconds;
  const f = breathFrame(beam, at.grow);
  const scale = Math.min(1, Math.max(0.2, at.grow));
  const head = f.ends[f.middle] ?? f.start;
  const specks = Array.from({ length: look.specks }, (_, i) => {
    const fall = (t * look.speckHz + i / look.specks) % 1;
    const d = 0.3 + (0.6 * i) / look.specks;
    const p = { x: f.start.x + (head.x - f.start.x) * d, y: f.start.y + (head.y - f.start.y) * d };
    return {
      x: p.x + Math.sin(i * 3 + t * 2) * 2,
      y: p.y + 3 + fall * look.speckFall,
      r: look.speckRadius * (1 - fall) + 0.3,
    };
  });
  const stream = sprayStream(
    { origin: beam.origin, ends: f.ends },
    { timeSeconds: t, look: look.stream }
  ).map((puff) => ({ x: puff.x, y: puff.y, r: puff.r * scale }));
  const [outline = [], inner = []] = puffFieldRings([...stream, ...bursts(f, beam, { t, scale })], {
    look: look.field,
    levels: [look.fillLevel, look.innerLevel],
  });
  return { outline, inner, specks, head, headRadius: look.burstRadius * scale };
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
