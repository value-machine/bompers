/**
 * Outline widths (DESIGN_LANGUAGE § 3, line style E). The design numbers are at the mockup's
 * reference blob (R = 30); the game blob is R ≈ 13.2 (height 28), so world widths scale by
 * `DESIGN_SCALE` (visual-pass D1). The on-screen width is clamped to [minPx, maxPx] at every
 * camera zoom, then converted back to world units. Widths are quantised in 10 % steps so layers
 * that bake a stroke into geometry redraw only when the step changes (visual-pass D4).
 */
export const DESIGN_SCALE = 0.44;

export type OutlineKind = "character" | "terrain" | "prop" | "effect";

interface OutlineSpec {
  /** Visible width in reference world units. */
  world: number;
  minPx: number;
  maxPx: number;
}

const OUTLINES: Readonly<Record<OutlineKind, OutlineSpec>> = {
  character: { world: 3.5, minPx: 2, maxPx: 4.5 },
  terrain: { world: 3.5, minPx: 2, maxPx: 4.5 },
  prop: { world: 2, minPx: 1.2, maxPx: 3 },
  effect: { world: 3, minPx: 1.5, maxPx: 4 },
};

const STEP = Math.log(1.1);

export interface OutlineWidth {
  /** Visible line width in world units (an ink pass strokes at twice this). */
  width: number;
  /** Quantisation step; equal steps mean equal widths. */
  step: number;
}

/** World width of one outline kind at a camera zoom (screen px per world unit). */
export function outlineWidth(kind: OutlineKind, zoom: number): OutlineWidth {
  const spec = OUTLINES[kind];
  const z = zoom > 0 && Number.isFinite(zoom) ? zoom : 1;
  const px = Math.min(spec.maxPx, Math.max(spec.minPx, spec.world * DESIGN_SCALE * z));
  const step = Math.round(Math.log(px / z) / STEP);
  return { width: Math.exp(step * STEP), step };
}
