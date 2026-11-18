/**
 * Helmet tube silhouettes per weapon (DESIGN_LANGUAGE § 9 Weapon identity, weapon-visuals D1): the
 * shape of the tube is the weapon cue, so the blob and the crate face draw the same geometry.
 * Plain round rects along +x from the pivot, scaled by `u = r / 30`; the Pixi tracer is
 * `shared/services/weaponTubeRenderer.ts`. A new weapon adds its shape id and parts here and its
 * look (accent, shape id) in `gamePalette.weaponLooks`.
 */
export type WeaponTubeShape = "capped" | "twin-pod" | "nozzle" | "emitter";

export interface TubePart {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
}

export interface WeaponTubeParts {
  parts: readonly TubePart[];
  /** Centre of each muzzle, where the ready light sits. */
  muzzles: readonly { x: number; y: number }[];
}

interface ShapeSpec {
  /** [x, y, width, height, radius] per part at u = 1. */
  parts: readonly (readonly [number, number, number, number, number])[];
  muzzles: readonly (readonly [number, number])[];
}

const SHAPES: Readonly<Record<WeaponTubeShape, ShapeSpec>> = {
  // Rocket launcher: tube 26 × 14 with its cap 8 × 16 (DESIGN_LANGUAGE § 2).
  capped: {
    parts: [
      [-3, -7, 26, 14, 6],
      [17, -8, 8, 16, 3.5],
    ],
    muzzles: [[21, 0]],
  },
  // Homing launcher: a short mount and two stacked pods (weapon-visuals mockup, direction A).
  "twin-pod": {
    parts: [
      [-3, -11, 9, 22, 4],
      [-1, -11, 24, 10, 5],
      [-1, 1, 24, 10, 5],
    ],
    muzzles: [
      [18, -6],
      [18, 6],
    ],
  },
  // Torch: a fuel can behind a thin nozzle that flares at the tip (fire-spread b1).
  nozzle: {
    parts: [
      [-3, -9, 12, 18, 6],
      [7, -3.5, 14, 7, 3],
      [19, -6, 6, 12, 3],
    ],
    muzzles: [[22, 0]],
  },
  // Freeze ray: a chunky body, a short neck and a wide flat dish at the tip (ice-element lap 1).
  emitter: {
    parts: [
      [-3, -7, 16, 14, 6],
      [11, -4, 8, 8, 3],
      [17, -9, 5, 18, 2.5],
    ],
    muzzles: [[19.5, 0]],
  },
};

/** The tube of `shape` at scale `u`. */
export function weaponTubeParts(shape: WeaponTubeShape, u: number): WeaponTubeParts {
  const { parts, muzzles } = SHAPES[shape];
  return {
    parts: parts.map(([x, y, width, height, radius]) => ({
      x: x * u,
      y: y * u,
      width: width * u,
      height: height * u,
      radius: radius * u,
    })),
    muzzles: muzzles.map(([x, y]) => ({ x: x * u, y: y * u })),
  };
}

/** Horizontal extent of a tube (left edge, right edge), to centre it as a mark. */
export function weaponTubeSpan(tube: WeaponTubeParts): { left: number; right: number } {
  const left = Math.min(...tube.parts.map((p) => p.x));
  const right = Math.max(...tube.parts.map((p) => p.x + p.width));
  return { left, right };
}
