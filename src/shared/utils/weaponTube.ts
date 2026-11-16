/**
 * Helmet tube silhouettes per weapon (DESIGN_LANGUAGE § 9 Weapon identity, weapon-visuals D1): the
 * shape of the tube is the weapon cue, so the blob and the crate face draw the same geometry.
 * Plain round rects along +x from the pivot, scaled by `u = r / 30`; the Pixi tracer is
 * `shared/services/weaponTubeRenderer.ts`. A new weapon adds its shape id and parts here and its
 * look (accent, shape id) in `gamePalette.weaponLooks`.
 *
 * Second copy (code-style § Naming F2): `features/player/services/blobShapes.ts` `tubePath` still
 * holds the capped tube until weapon-visuals phase 2 switches it to these parts.
 */
export type WeaponTubeShape = "capped" | "twin-pod";

export interface TubePart {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
}

export interface WeaponTubeParts {
  parts: readonly TubePart[];
  /** Centre of the muzzle, where the ready light sits. */
  muzzle: { x: number; y: number };
}

const part = (u: number, [x, y, width, height, radius]: readonly number[]): TubePart => ({
  x: (x ?? 0) * u,
  y: (y ?? 0) * u,
  width: (width ?? 0) * u,
  height: (height ?? 0) * u,
  radius: (radius ?? 0) * u,
});

/** Shapes at u = 1: [x, y, width, height, radius] per part, and the muzzle point. */
const SHAPES: Readonly<
  Record<WeaponTubeShape, { parts: readonly (readonly number[])[]; muzzle: [number, number] }>
> = {
  // Rocket launcher: tube 26 × 14 with its cap 8 × 16 (DESIGN_LANGUAGE § 2).
  capped: {
    parts: [
      [-3, -7, 26, 14, 6],
      [17, -8, 8, 16, 3.5],
    ],
    muzzle: [21, 0],
  },
  // Homing launcher: a short mount and two stacked pods (weapon-visuals mockup, direction A).
  "twin-pod": {
    parts: [
      [-3, -11, 9, 22, 4],
      [-1, -11, 24, 10, 5],
      [-1, 1, 24, 10, 5],
    ],
    muzzle: [19, 0],
  },
};

/** The tube of `shape` at scale `u`. */
export function weaponTubeParts(shape: WeaponTubeShape, u: number): WeaponTubeParts {
  const { parts, muzzle } = SHAPES[shape];
  return {
    parts: parts.map((numbers) => part(u, numbers)),
    muzzle: { x: muzzle[0] * u, y: muzzle[1] * u },
  };
}

/** Horizontal extent of a tube (left edge, right edge), to centre it as a mark. */
export function weaponTubeSpan(tube: WeaponTubeParts): { left: number; right: number } {
  const left = Math.min(...tube.parts.map((p) => p.x));
  const right = Math.max(...tube.parts.map((p) => p.x + p.width));
  return { left, right };
}
