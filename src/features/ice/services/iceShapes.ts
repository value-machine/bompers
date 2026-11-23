import type { Vec2 } from "@/shared/types/gameGeometry.types";
import type { OutlineRing } from "@/shared/utils/contourRings";
import { inkStroke, outlineWidth } from "@/shared/utils/outlineWidth";
import { puffFieldRings } from "@/shared/utils/puffField";
import type {
  SprayBurst,
  SprayParticleStream,
  SprayPuff,
} from "@/shared/types/sprayParticles.types";

/**
 * Ice geometry: pure shapes the ice renderer fills. Frozen ground itself is drawn by the renderer
 * as the terrain's contour limited to the frozen samples, the way a fire's body is (owner,
 * ice-element D4: "the same shape as a burning shape could also be a frozen shape";
 * element-overlay-shape D1). Here: the gloss streaks on it, at fixed places, the slippery cue of
 * DESIGN_LANGUAGE § 2.
 * The freeze ray is "Cold breath" (owner, ice-element D9) drawn as the "Cloud shape" (owner,
 * freeze-ray-shape D1): its puffs are the sim's own particles (owner, freeze-ray-particles D1,
 * `sprayParticles`), drawn where they are, growing as they travel and bursting where they land;
 * they melt into ONE shape (`puffFieldRings`) whose outline morphs as they flow, drawn with the
 * shared ink stroke. What is seen is what the cold reaches.
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
    /** The merged shape: its grid, how far a puff's bump reaches, and the fill and inner levels. */
    field: { cell: 4, reach: 2 },
    fillLevel: 0.35,
    innerLevel: 1.3,
    /** A puff's radius as it leaves, what it adds by its full reach, and where it starts to fade. */
    puffRadius: 3.5,
    puffGrow: 7,
    // Thins out over the last 45 % of the reach (owner, 2026-11-23: the end was "a full stop",
    // "a little bit sudden"), eased, so the tail tapers into wisps.
    fadeFrom: 0.55,
    /** Where a puff lands: this many burst puffs of this radius roll around it while it shows. */
    burstPuffs: 5,
    burstRadius: 7,
    rollHz: 0.4,
    /** One snow speck falls from every this-many puffs. */
    speckEvery: 16,
    /** Snow specks: how far they fall, their radius, falls per second. */
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
}

const TAU = Math.PI * 2;

/**
 * A puff's drawn disc: shown once past the emitter knob, growing with the distance flown and
 * fading out over the last stretch of its reach.
 */
function puffDisc(puff: SprayPuff, length: number): Disc | null {
  const look = ICE_LOOK.breath;
  if (puff.travelled < look.emitterReach) return null;
  const u = Math.min(1, puff.travelled / length);
  const k = Math.max(0, (u - look.fadeFrom) / (1 - look.fadeFrom));
  // Smooth ease-out to nothing: no kink where the fade starts, no pop where it ends.
  const fade = 1 - k * k * (3 - 2 * k);
  return { x: puff.x, y: puff.y, r: (look.puffRadius + look.puffGrow * u) * fade };
}

/** Burst puffs rolling around each landed puff, shrinking as the burst ends. */
function burstDiscs(
  bursts: readonly SprayBurst[],
  at: { t: number; seconds: number; slot: number }
): Disc[] {
  const look = ICE_LOOK.breath;
  const turn = at.t * TAU * look.rollHz + at.slot;
  return bursts.flatMap((burst, i) => {
    const k = Math.min(1, Math.max(0, (at.t - burst.at) / at.seconds));
    // Shrinks to nothing as the burst ends, so a landed puff never pops out of view.
    const r = look.burstRadius * (1 - k);
    return Array.from({ length: look.burstPuffs }, (_, j) => {
      const a = turn + i * 1.7 + (j * TAU) / look.burstPuffs;
      return {
        x: burst.x + Math.cos(a) * r * 0.7,
        y: burst.y + Math.sin(a) * r * 0.5 - r * 0.3,
        r: r * (0.75 + 0.2 * Math.sin(at.t * 5 + i + j)),
      };
    });
  });
}

/**
 * One freeze ray's puffs as one cloud shape. `length` is the ray's full reach (puffs fade out
 * toward it); `burstSeconds` how long a landed puff's burst shows; `timeSeconds` is sim time.
 */
export function breathShape(
  spray: { slot: number; stream: SprayParticleStream },
  at: { timeSeconds: number; length: number; burstSeconds: number }
): BreathShape {
  const look = ICE_LOOK.breath;
  const t = at.timeSeconds;
  const { puffs, bursts } = spray.stream;
  const discs = puffs.flatMap((puff) => puffDisc(puff, at.length) ?? []);
  const specks = puffs
    .filter((_, i) => i % look.speckEvery === 0)
    .map((puff, i) => {
      const fall = (t * look.speckHz + i * 0.37) % 1;
      return {
        x: puff.x + Math.sin(i * 3 + t * 2) * 2,
        y: puff.y + 3 + fall * look.speckFall,
        r: look.speckRadius * (1 - fall) + 0.3,
      };
    });
  const all = [...discs, ...burstDiscs(bursts, { t, seconds: at.burstSeconds, slot: spray.slot })];
  const [outline = [], inner = []] = puffFieldRings(all, {
    look: look.field,
    levels: [look.fillLevel, look.innerLevel],
  });
  return { outline, inner, specks };
}
