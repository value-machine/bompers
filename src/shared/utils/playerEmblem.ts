/**
 * The helmet emblem of a player slot (● ▲ ■ ✚, DESIGN_LANGUAGE § 1: the second cue next to
 * colour), as plain geometry centred on 0,0 so every surface draws the same shape: the
 * helmet and HUD chip (Pixi, `shared/services/emblemRenderer.ts`) and the lobby (SVG).
 */
export type EmblemShape =
  | { kind: "circle"; radius: number }
  | { kind: "polygon"; points: readonly number[] }
  | { kind: "roundRect"; x: number; y: number; width: number; height: number; radius: number };

/** Emblem glyphs by slot, for text (labels, accessible names). */
export const PLAYER_EMBLEM_GLYPHS = ["●", "▲", "■", "✚"] as const;

/** Readable emblem names by slot. */
export const PLAYER_EMBLEM_NAMES = ["circle", "triangle", "square", "plus"] as const;

/** Plus sign outline: arm half-width `a`, arm reach `b`. */
const plusPoints = (a: number, b: number): number[] => [
  -a,
  -b,
  a,
  -b,
  a,
  -a,
  b,
  -a,
  b,
  a,
  a,
  a,
  a,
  b,
  -a,
  b,
  -a,
  a,
  -b,
  a,
  -b,
  -a,
  -a,
  -a,
];

/** The emblem of `slot` at scale `s` (about its radius). */
export function playerEmblemShape(slot: number, s: number): EmblemShape {
  switch (slot % 4) {
    case 0:
      return { kind: "circle", radius: s };
    case 1:
      return { kind: "polygon", points: [0, -1.1 * s, 1.05 * s, 0.8 * s, -1.05 * s, 0.8 * s] };
    case 2:
      return {
        kind: "roundRect",
        x: -0.9 * s,
        y: -0.9 * s,
        width: 1.8 * s,
        height: 1.8 * s,
        radius: 0.25 * s,
      };
    default:
      return { kind: "polygon", points: plusPoints(0.38 * s, 1.05 * s) };
  }
}
