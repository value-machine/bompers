import type { Rect, Shape2D, Vec2 } from "@/shared/types/gameGeometry.types";
import { shapeSignedDistance } from "@/shared/utils/shapeGeometry";
import type { ObjectRotation } from "@/features/level-objects/types/levelObject.types";

/**
 * Footing (level-orbit D3): an object should stand on the ground it was drawn on, facing away
 * from it. An author writing blind can see neither, so the importer checks each object's base
 * (the bottom centre of its box, turned with it) against the terrain shapes: off the ground, in
 * it, or leaning more than `MAX_LEAN_DEGREES` from the surface's outward direction is an issue
 * that carries the SVG rotate that fits. Pure.
 */

/** A base this far from the nearest surface (in or out) still stands on it. */
const FOOT_TOLERANCE = 12;
/** More lean than this from the surface's outward direction is an issue. */
const MAX_LEAN_DEGREES = 30;
/** Half the step of the gradient that finds the surface direction. */
const NORMAL_STEP = 2;

/** What footing needs of a placed object: its upright box and optional turn. */
export interface ObjectStance {
  box: Rect;
  rotation?: ObjectRotation;
}

export type ObjectFootingIssue =
  | { kind: "off-ground" | "in-ground"; base: Vec2; distance: number }
  | { kind: "leaning"; base: Vec2; degrees: number; fitDegrees: number };

function turn(p: Vec2, rotation: ObjectRotation | undefined): Vec2 {
  if (!rotation) return p;
  const a = (rotation.degrees * Math.PI) / 180;
  const x = p.x - rotation.about.x;
  const y = p.y - rotation.about.y;
  return {
    x: rotation.about.x + x * Math.cos(a) - y * Math.sin(a),
    y: rotation.about.y + x * Math.sin(a) + y * Math.cos(a),
  };
}

/** Base point and unit "up" direction of a placed object, in the world. */
export function objectFooting({ box, rotation }: ObjectStance): { base: Vec2; up: Vec2 } {
  const base = turn({ x: box.x + box.w / 2, y: box.y + box.h }, rotation);
  const above = turn({ x: box.x + box.w / 2, y: box.y + box.h - 1 }, rotation);
  return { base, up: { x: above.x - base.x, y: above.y - base.y } };
}

/** SVG rotate degrees (clockwise, y down) that turn "up" (0, -1) into `dir`, rounded. */
const rotateDegreesFor = (dir: Vec2): number =>
  Math.round((Math.atan2(dir.x, -dir.y) * 180) / Math.PI);

type Field = (p: Vec2) => number;

/** Unit direction out of the terrain at `p` (null on a flat spot of the field). */
function outwardAt(field: Field, p: Vec2): Vec2 | null {
  const gx = field({ x: p.x + NORMAL_STEP, y: p.y }) - field({ x: p.x - NORMAL_STEP, y: p.y });
  const gy = field({ x: p.x, y: p.y + NORMAL_STEP }) - field({ x: p.x, y: p.y - NORMAL_STEP });
  const len = Math.hypot(gx, gy);
  return len === 0 ? null : { x: -gx / len, y: -gy / len };
}

/** The footing issue of one object on `ground` (terrain shapes), or null when it stands well. */
export function footingIssue(
  object: ObjectStance,
  ground: readonly Shape2D[]
): ObjectFootingIssue | null {
  if (ground.length === 0) return null;
  const field: Field = (p) => Math.max(...ground.map((shape) => shapeSignedDistance(shape, p)));
  const { base, up } = objectFooting(object);
  const depth = field(base);
  if (Math.abs(depth) > FOOT_TOLERANCE) {
    const kind = depth > 0 ? "in-ground" : "off-ground";
    return { kind, base, distance: Math.abs(depth) };
  }
  const out = outwardAt(field, base);
  if (!out) return null;
  const cos = Math.max(-1, Math.min(1, up.x * out.x + up.y * out.y));
  const degrees = (Math.acos(cos) * 180) / Math.PI;
  if (degrees <= MAX_LEAN_DEGREES) return null;
  return { kind: "leaning", base, degrees, fitDegrees: rotateDegreesFor(out) };
}
