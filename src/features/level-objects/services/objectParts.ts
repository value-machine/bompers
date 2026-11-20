import type { Vec2 } from "@/shared/types/gameGeometry.types";
import type {
  ObjectPart,
  ObjectPartRole,
  ObjectRotation,
} from "@/features/level-objects/types/levelObject.types";

/**
 * Part builders for object recipes, in a recipe's local frame: origin at the object's base
 * (bottom centre), y up is negative, so a recipe reads like a drawing. `toBox` moves the parts
 * to the placed box. Every part is at least `MIN_PART_THICKNESS` thick (level-objects D9).
 */

/** Two terrain samples (cell size 4): thinner parts would have no outline or collision. */
export const MIN_PART_THICKNESS = 8;

export interface PartLook {
  materialId: string;
  colorId: string;
  part: ObjectPartRole;
}

export const circlePart = (at: Vec2, r: number, look: PartLook): ObjectPart => ({
  shape: { type: "circle", cx: at.x, cy: at.y, r: Math.max(r, MIN_PART_THICKNESS / 2) },
  ...look,
});

export const polygonPart = (points: readonly Vec2[], look: PartLook): ObjectPart => ({
  shape: { type: "polygon", points },
  ...look,
});

/** A tapered bar from `from` (width `w0`) to `to` (width `w1`), widths at least the minimum. */
export function limbPart(
  ends: { from: Vec2; to: Vec2; w0: number; w1: number },
  look: PartLook
): ObjectPart {
  const { from, to } = ends;
  const len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  const nx = -(to.y - from.y) / len;
  const ny = (to.x - from.x) / len;
  const h0 = Math.max(ends.w0, MIN_PART_THICKNESS) / 2;
  const h1 = Math.max(ends.w1, MIN_PART_THICKNESS) / 2;
  return polygonPart(
    [
      { x: from.x + nx * h0, y: from.y + ny * h0 },
      { x: to.x + nx * h1, y: to.y + ny * h1 },
      { x: to.x - nx * h1, y: to.y - ny * h1 },
      { x: from.x - nx * h0, y: from.y - ny * h0 },
    ],
    look
  );
}

const roundTo = (n: number): number => Math.round(n * 100) / 100;

/** Moves local parts so the origin sits on `base` (world), rounding to 0.01 units. */
export function toBox(parts: readonly ObjectPart[], base: Vec2): ObjectPart[] {
  const move = (p: Vec2): Vec2 => ({ x: roundTo(base.x + p.x), y: roundTo(base.y + p.y) });
  return parts.map((part) => {
    const { shape } = part;
    if (shape.type === "circle") {
      const c = move({ x: shape.cx, y: shape.cy });
      return { ...part, shape: { type: "circle", cx: c.x, cy: c.y, r: roundTo(shape.r) } };
    }
    if (shape.type === "polygon")
      return { ...part, shape: { type: "polygon", points: shape.points.map(move) } };
    const c = move({ x: shape.x, y: shape.y });
    return { ...part, shape: { ...shape, x: c.x, y: c.y } };
  });
}

/** Keeps a local point inside a box of `w` × `h` (local frame), `margin` from its edges. */
export function insideLocalBox(p: Vec2, box: { w: number; h: number }, margin: number): Vec2 {
  const half = box.w / 2 - margin;
  return {
    x: Math.min(half, Math.max(-half, p.x)),
    y: Math.min(-margin, Math.max(-box.h + margin, p.y)),
  };
}

/**
 * Turns placed parts about a world point (level-orbit D1). Circles keep their radius; a rect
 * part becomes the polygon of its turned corners. Rounds to 0.01 units like `toBox`.
 */
export function rotateParts(parts: readonly ObjectPart[], rotation: ObjectRotation): ObjectPart[] {
  const a = (rotation.degrees * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const { about } = rotation;
  const turn = (p: Vec2): Vec2 => {
    const x = p.x - about.x;
    const y = p.y - about.y;
    return { x: roundTo(about.x + x * cos - y * sin), y: roundTo(about.y + x * sin + y * cos) };
  };
  return parts.map((part) => {
    const { shape } = part;
    if (shape.type === "circle") {
      const c = turn({ x: shape.cx, y: shape.cy });
      return { ...part, shape: { type: "circle", cx: c.x, cy: c.y, r: shape.r } };
    }
    if (shape.type === "polygon")
      return { ...part, shape: { type: "polygon", points: shape.points.map(turn) } };
    const { x, y, w, h } = shape;
    const corners = [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ];
    return { ...part, shape: { type: "polygon", points: corners.map(turn) } };
  });
}
