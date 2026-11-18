import type { BeamClash } from "@/shared/types/beamClash.types";
import type { ElementPairs } from "@/shared/types/element.types";
import type { Vec2 } from "@/shared/types/gameGeometry.types";
import type { PosedField } from "@/shared/types/sampleFront.types";
import { ELEMENT_PAIRS, elementPairReaction } from "@/shared/utils/elementPairs";
import { castRayFan, rayDirections, type RayFanShape } from "@/shared/utils/rayFan";

/**
 * What happens where two held beams (ray fans, `rayFan.ts`) meet (owner, beam-clash D1, the
 * "Steam wall"): two beams whose elements react end each other where they touch, and nothing of
 * either gets past. Both reach out from their emitter at the same pace, so they end at the same
 * distance from their own emitter; a beam that would get there later ends on the other's side
 * and the other keeps its length. Which elements react is the element pair table
 * (`elementPairs.ts`, beam-clash D2, mover-materials D1): fire and cold are the first pair, a
 * pair without a row passes through, as two beams of one element do.
 */
/** One held beam this step: its ray fan and its element. */
export interface ClashBeam {
  origin: Vec2;
  /** Aim direction (any length). */
  aim: Vec2;
  shape: RayFanShape;
  /** The element ID the pair table knows it by (`ElementId` in the game). */
  element: string;
}

export interface BeamClashes {
  /** How far each beam goes this step: its own length, or less when a clash ends it. */
  reach: number[];
  clashes: BeamClash[];
}

export interface BeamClashLook {
  /** How close two beams must come to count as touching, world units. */
  thickness: number;
  /** Which element pairs react; the game's element pair table when left out. */
  pairs?: ElementPairs;
}

/** A beam's fan, cast once: unit aim, ray directions and how far each ray is free of terrain. */
interface Fan {
  origin: Vec2;
  aim: Vec2;
  spread: number;
  length: number;
  dirs: Vec2[];
  free: number[];
}

function fanOf(fields: readonly PosedField[], beam: ClashBeam): Fan {
  const hits = castRayFan({
    fields,
    bodies: [],
    origin: beam.origin,
    aim: beam.aim,
    shape: beam.shape,
  });
  return {
    origin: beam.origin,
    aim: hits.aim,
    spread: Math.tan((beam.shape.halfAngleDegrees * Math.PI) / 180),
    length: beam.shape.length,
    dirs: rayDirections(hits.aim, beam.shape),
    free: hits.rays.map((ray) => Math.hypot(ray.end.x - beam.origin.x, ray.end.y - beam.origin.y)),
  };
}

/** Whether the fan, cut off at `cap` from its emitter, comes within `thickness` of `p`. */
function covers(fan: Fan, p: Vec2, limits: { cap: number; thickness: number }): boolean {
  const vx = p.x - fan.origin.x;
  const vy = p.y - fan.origin.y;
  const distance = Math.hypot(vx, vy);
  if (distance > limits.cap) return false;
  const along = vx * fan.aim.x + vy * fan.aim.y;
  if (along <= 0) return false;
  const across = Math.abs(vx * fan.aim.y - vy * fan.aim.x);
  if (across > along * fan.spread + limits.thickness) return false;
  // Terrain: the fan reaches p only as far as its ray nearest to p is free.
  let nearest = 0;
  let best = -Infinity;
  fan.dirs.forEach((dir, i) => {
    const dot = vx * dir.x + vy * dir.y;
    if (dot > best) {
      best = dot;
      nearest = i;
    }
  });
  return distance <= (fan.free[nearest] ?? 0) + limits.thickness;
}

interface Meeting {
  a: Fan;
  b: Fan;
  /** How far each fan goes from its emitter. */
  capA: number;
  capB: number;
  thickness: number;
  /** Spacing of the points tried along a ray. */
  stride: number;
}

/** First point of one fan's rays (up to its cap and its terrain) that the other fan covers. */
function touchOf(from: Fan, to: Fan, m: { capFrom: number; capTo: number } & Meeting): Vec2 | null {
  const limits = { cap: m.capTo, thickness: m.thickness };
  for (let i = 0; i < from.dirs.length; i += 1) {
    const dir = from.dirs[i];
    if (!dir) continue;
    const end = Math.min(m.capFrom, from.free[i] ?? 0);
    for (
      let s = Math.min(m.stride, end);
      s <= end;
      s = s < end ? Math.min(s + m.stride, end) : end + 1
    ) {
      const p = { x: from.origin.x + dir.x * s, y: from.origin.y + dir.y * s };
      if (covers(to, p, limits)) return p;
    }
  }
  return null;
}

const touch = (m: Meeting): Vec2 | null =>
  touchOf(m.a, m.b, { ...m, capFrom: m.capA, capTo: m.capB }) ??
  touchOf(m.b, m.a, { ...m, capFrom: m.capB, capTo: m.capA });

/** Halvings of the reach when looking for where two beams first touch (under a unit at 180). */
const SEARCH_STEPS = 9;

/** Where two fans growing at the same pace first touch: that distance and the point. */
function meetingOf(a: Fan, b: Fan, look: { thickness: number; stride: number }) {
  const gap = Math.hypot(a.origin.x - b.origin.x, a.origin.y - b.origin.y);
  if (gap > a.length + b.length + look.thickness) return null;
  const at = (r: number): Meeting => ({
    a,
    b,
    capA: Math.min(a.length, r),
    capB: Math.min(b.length, r),
    ...look,
  });
  let high = Math.max(a.length, b.length);
  let point = touch(at(high));
  if (!point) return null;
  let low = 0;
  for (let i = 0; i < SEARCH_STEPS; i += 1) {
    const mid = (low + high) / 2;
    const found = touch(at(mid));
    if (found) {
      high = mid;
      point = found;
    } else low = mid;
  }
  return { reach: high, at: point };
}

/**
 * This step's beam clashes: for every pair of beams whose elements react and that touch, both
 * end at the distance where they first touch (a beam shorter than that keeps its length).
 * Terrain counts, moving parts too: a beam behind a wall or a part does not reach the meeting.
 */
export function resolveBeamClashes(
  fields: readonly PosedField[],
  beams: readonly ClashBeam[],
  look: BeamClashLook
): BeamClashes {
  const pairs = look.pairs ?? (ELEMENT_PAIRS as ElementPairs);
  const reach = beams.map((beam) => beam.shape.length);
  const clashes: BeamClash[] = [];
  if (beams.length < 2) return { reach, clashes };
  const fans = beams.map((beam) => fanOf(fields, beam));
  const search = { thickness: look.thickness, stride: fields[0]?.field.cellSize ?? 1 };
  beams.forEach((beam, i) => {
    for (let j = i + 1; j < beams.length; j += 1) {
      const other = beams[j];
      const a = fans[i];
      const b = fans[j];
      if (!other || !a || !b) continue;
      const reaction = elementPairReaction(beam.element, other.element, pairs);
      const meeting = reaction && meetingOf(a, b, search);
      if (!reaction || !meeting) continue;
      reach[i] = Math.min(reach[i] ?? 0, meeting.reach);
      reach[j] = Math.min(reach[j] ?? 0, meeting.reach);
      clashes.push({ at: meeting.at, reaction, beams: [i, j] });
    }
  });
  return { reach, clashes };
}
