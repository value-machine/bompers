/**
 * Helmet barrel per weapon (DESIGN_LANGUAGE § 9 Weapon identity; weapon-visuals-embellish D1, D3,
 * D6–D8): every weapon has one tapered barrel that starts at the helmet centre (the pivot, x = 0)
 * and points along +x. Only the mouth differs per weapon, so the blob and the crate draw the same
 * geometry. Units are mockup units, scaled by `u = r / 30`; the Pixi tracer is
 * `shared/services/weaponTubeRenderer.ts`. A new weapon adds its shape id and mouth here and its
 * look (accent, shape id) in `gamePalette.weaponLooks`.
 */
export type WeaponTubeShape = "lip" | "finned" | "funnel" | "dish";

/** `barrel` is filled like the helmet; `mouth` carries the weapon accent and the ready light. */
export type TubeRole = "barrel" | "mouth";

export type TubePart = { role: TubeRole } & (
  | { kind: "rect"; x: number; y: number; width: number; height: number; radius: number }
  /** Closed polygon, flat `[x0, y0, x1, y1, …]`. */
  | { kind: "poly"; points: readonly number[] }
);

export interface WeaponTubeParts {
  parts: readonly TubePart[];
}

export interface WeaponTubeMark extends WeaponTubeParts {
  /** Centre of the mark's bounds: put this point on the middle of the crate. */
  centre: { x: number; y: number };
}

type Rect = readonly [x: number, y: number, width: number, height: number, radius: number];

interface ShapeSpec {
  /** Taper from `rootHalf` at the pivot to `tipHalf` at `length` (half-widths). */
  barrel: { length: number; rootHalf: number; tipHalf: number };
  mouthRects: readonly Rect[];
  mouthPolys: readonly (readonly number[])[];
}

const LIP: Rect = [38, -8.5, 8, 17, 3.5];
const BARREL = { length: 40, rootHalf: 13, tipHalf: 7.5 };

const SHAPES: Readonly<Record<WeaponTubeShape, ShapeSpec>> = {
  // Rocket launcher: the plain barrel with a lip.
  lip: { barrel: BARREL, mouthRects: [LIP], mouthPolys: [] },
  // Homing launcher: the lip with two fins swept back toward the helmet.
  finned: {
    barrel: BARREL,
    mouthRects: [LIP],
    mouthPolys: [
      [38, -8, 27, -19, 22, -19, 24, -9.5],
      [38, 8, 27, 19, 22, 19, 24, 9.5],
    ],
  },
  // Torch: a shorter barrel that opens into a funnel (the flame comes from the fire layer).
  funnel: {
    barrel: { length: 30, rootHalf: 13, tipHalf: 7 },
    mouthRects: [],
    mouthPolys: [[28, -7, 44, -14, 47.5, -7, 48.5, 0, 47.5, 7, 44, 14, 28, 7]],
  },
  // Freeze ray: a wide flat dish with a small emitter knob in front (ice-element lap 1's emitter).
  dish: {
    barrel: BARREL,
    mouthRects: [
      [37, -14, 7, 28, 3.5],
      [42, -4, 8, 8, 4],
    ],
    mouthPolys: [],
  },
};

/** Where the crate mark cuts the barrel: only the mouth end is shown. */
const MARK_FROM = 16;

function buildParts(shape: WeaponTubeShape, u: number, from: number): TubePart[] {
  const { barrel, mouthRects, mouthPolys } = SHAPES[shape];
  const { length, rootHalf, tipHalf } = barrel;
  const fromHalf = rootHalf + ((tipHalf - rootHalf) * from) / length;
  const scale = (points: readonly number[]): number[] => points.map((value) => value * u);
  return [
    {
      role: "barrel",
      kind: "poly",
      points: scale([from, -fromHalf, length, -tipHalf, length, tipHalf, from, fromHalf]),
    },
    ...mouthRects.map(
      ([x, y, width, height, radius]): TubePart => ({
        role: "mouth",
        kind: "rect",
        x: x * u,
        y: y * u,
        width: width * u,
        height: height * u,
        radius: radius * u,
      })
    ),
    ...mouthPolys.map(
      (points): TubePart => ({ role: "mouth", kind: "poly", points: scale(points) })
    ),
  ];
}

/** The barrel of `shape` at scale `u`, from the pivot. */
export const weaponTubeParts = (shape: WeaponTubeShape, u: number): WeaponTubeParts => ({
  parts: buildParts(shape, u, 0),
});

/** Bounds of a set of parts. */
export function weaponTubeBounds(parts: readonly TubePart[]): {
  left: number;
  right: number;
  top: number;
  bottom: number;
} {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const part of parts) {
    if (part.kind === "rect") {
      xs.push(part.x, part.x + part.width);
      ys.push(part.y, part.y + part.height);
    } else {
      part.points.forEach((value, i) => (i % 2 === 0 ? xs : ys).push(value));
    }
  }
  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys),
  };
}

/** The mouth end of `shape` as a mark (crate face), with the centre of its bounds. */
export function weaponTubeMark(shape: WeaponTubeShape, u: number): WeaponTubeMark {
  const parts = buildParts(shape, u, MARK_FROM);
  const { left, right, top, bottom } = weaponTubeBounds(parts);
  return { parts, centre: { x: (left + right) / 2, y: (top + bottom) / 2 } };
}
