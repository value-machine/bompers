import type { Vec2 } from "@/shared/types/gameGeometry.types";
import type { GameTunables } from "@/shared/types/gameTunables.types";
import { nearestFreeOffset } from "@/shared/utils/freeSpotSearch";
import {
  FIELD_BAND_SAMPLES,
  fieldDistanceAt,
  fieldNormalAt,
  type TerrainGrid,
} from "@/features/arena/api/arenaApi";
import type { PhysicsObject } from "@/features/physics-objects/types/physicsObject.types";

/**
 * A round physics body on the terrain field (physics-objects D1: our own sim, the same field the
 * blobs walk on, moving parts included): gravity, sub-stepped moves that never tunnel, push-out
 * along the field normal, a bounce by the variant's restitution, rolling drag, and the shared
 * never-stuck search when something left it deep in solid. Pure TS, mutates the object.
 */

/** Probe circles on the ball's shell (the field is exact only within its band). */
const PROBE_DIRECTIONS = 16;
/** Share of the field band a probe circle may use. */
const PROBE_BAND_SHARE = 0.75;
/** Push-out passes per sub-step (a ball wedged in a corner needs a second). */
const PUSH_PASSES = 3;
/** A contact this shallow is touching, not overlapping (world units). */
const CONTACT_SLOP = 0.05;

export interface CircleContact {
  /** How far the circle reaches into terrain, world units. */
  depth: number;
  /** Out of the terrain at the deepest point. */
  normal: Vec2;
}

/**
 * Deepest overlap of a circle with terrain (static and moving parts), or null when free. A circle
 * wider than the field band is read as probe circles on its shell, each inside the band.
 */
export function circleContact(
  terrain: TerrainGrid,
  center: Vec2,
  radius: number
): CircleContact | null {
  const band = FIELD_BAND_SAMPLES * terrain.cellSize * PROBE_BAND_SHARE;
  const probe = Math.min(radius, band);
  const ring = radius - probe;
  let deepest: { depth: number; at: Vec2 } | null = null;
  const count = ring > 0 ? PROBE_DIRECTIONS : 1;
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const at = { x: center.x + Math.cos(angle) * ring, y: center.y + Math.sin(angle) * ring };
    const depth = fieldDistanceAt(terrain, at) + probe;
    if (depth > CONTACT_SLOP && (!deepest || depth > deepest.depth)) deepest = { depth, at };
  }
  if (!deepest) return null;
  return { depth: deepest.depth, normal: fieldNormalAt(terrain, deepest.at) };
}

/** The object overlaps terrain where it is, moved by `offset`. */
export const objectHitsAt = (terrain: TerrainGrid, object: PhysicsObject, offset: Vec2): boolean =>
  circleContact(terrain, { x: object.x + offset.x, y: object.y + offset.y }, object.radius) !==
  null;

export interface MotionStep {
  terrain: TerrainGrid;
  tunables: GameTunables;
  dt: number;
}

/** Bounce or rest along `normal`; returns the impact speed (0 when it was moving away). */
function respond(object: PhysicsObject, normal: Vec2, tunables: GameTunables): number {
  const into = object.vx * normal.x + object.vy * normal.y;
  if (into >= 0) return 0;
  const impact = -into;
  const bounce = impact < tunables.physicsObjects.restingSpeed ? 0 : object.body.restitution;
  object.vx -= (1 + bounce) * into * normal.x;
  object.vy -= (1 + bounce) * into * normal.y;
  return impact;
}

/** Push-out passes at the current position; returns the hardest impact and the last normal. */
function resolveTerrain(
  object: PhysicsObject,
  step: MotionStep
): { impact: number; normal: Vec2 | null; free: boolean } {
  let impact = 0;
  let normal: Vec2 | null = null;
  for (let pass = 0; pass < PUSH_PASSES; pass += 1) {
    const contact = circleContact(step.terrain, object, object.radius);
    if (!contact) return { impact, normal, free: true };
    object.x += contact.normal.x * contact.depth;
    object.y += contact.normal.y * contact.depth;
    impact = Math.max(impact, respond(object, contact.normal, step.tunables));
    normal = contact.normal;
  }
  // Still overlapping after every pass: wedged (the caller frees it with the shared search).
  return { impact, normal, free: circleContact(step.terrain, object, object.radius) === null };
}

function capSpeed(object: PhysicsObject, max: number): void {
  const speed = Math.hypot(object.vx, object.vy);
  if (speed <= max) return;
  object.vx = (object.vx / speed) * max;
  object.vy = (object.vy / speed) * max;
}

/** Rolling: drag along the ground and the turn of the drawn ball (none while frozen: it slides). */
function roll(object: PhysicsObject, normal: Vec2, step: MotionStep): void {
  const frozen = object.state.kind === "frozen";
  const drag = frozen ? step.tunables.physicsObjects.frozenDrag : object.body.rollDrag;
  const keep = Math.max(0, 1 - drag * step.dt);
  object.vx *= keep;
  object.vy *= keep;
  if (frozen) return;
  // Along the ground (normal turned a quarter clockwise): rolling right on a floor turns clockwise.
  const along = object.vx * -normal.y + object.vy * normal.x;
  object.angle += (along / object.radius) * step.dt;
}

/** What one step of motion did: the hardest impact (units / s) and whether it ended in solid. */
export interface MotionResult {
  impact: number;
  stuck: boolean;
}

/**
 * One step of motion through the terrain: the hardest impact this step (for the bounce moment)
 * and whether the object is left overlapping solid (only then does the caller run the never-stuck
 * search, so a free object costs no extra field reads).
 */
export function stepObjectMotion(object: PhysicsObject, step: MotionStep): MotionResult {
  const { terrain, tunables, dt } = step;
  object.vy += tunables.world.gravity * dt;
  capSpeed(object, tunables.physicsObjects.maxSpeed);
  const { impact, ground, free } = moveThrough(object, step);
  // Touching ground this step already says grounded; only otherwise probe just below.
  const below = ground
    ? null
    : circleContact(terrain, { x: object.x, y: object.y + 1 }, object.radius);
  const normal = ground ?? below?.normal ?? null;
  object.grounded = normal !== null;
  if (normal) roll(object, normal, step);
  return { impact, stuck: !free };
}

/** This step's move in sub-steps of half a cell, each resolved against terrain. */
function moveThrough(
  object: PhysicsObject,
  step: MotionStep
): { impact: number; ground: Vec2 | null; free: boolean } {
  const distance = Math.hypot(object.vx, object.vy) * step.dt;
  const steps = Math.max(1, Math.ceil(distance / (step.terrain.cellSize / 2)));
  let impact = 0;
  let ground: Vec2 | null = null;
  let free = true;
  for (let i = 0; i < steps; i += 1) {
    object.x += (object.vx * step.dt) / steps;
    object.y += (object.vy * step.dt) / steps;
    const hit = resolveTerrain(object, step);
    impact = Math.max(impact, hit.impact);
    ground = hit.normal ?? ground;
    free = hit.free;
  }
  return { impact, ground, free };
}

/**
 * The never-stuck rule for objects (physics-objects D3): an object left overlapping solid (a
 * moving part, a deep push) moves to the nearest free spot within its diameter, by the same
 * search the blobs use. False when there is none (the caller pops it).
 */
export function freeStuckObject(object: PhysicsObject, terrain: TerrainGrid): boolean {
  const normal = fieldNormalAt(terrain, object);
  const offset = nearestFreeOffset({
    hitsAt: (by) => objectHitsAt(terrain, object, by),
    startAngle: Math.atan2(normal.y, normal.x),
    maxReach: object.radius * 2,
  });
  if (!offset) return false;
  object.x += offset.x;
  object.y += offset.y;
  return true;
}

/**
 * Moves the object up to `by`, stopping at the first terrain (sub-steps of half a cell, then
 * bisection to contact). Returns the distance actually moved. For pushes by blobs and other
 * objects: a push never moves an object into terrain.
 */
export function moveObjectSafely(object: PhysicsObject, by: Vec2, terrain: TerrainGrid): number {
  const length = Math.hypot(by.x, by.y);
  if (length < 1e-9) return 0;
  const steps = Math.max(1, Math.ceil(length / (terrain.cellSize / 2)));
  const unit = { x: by.x / length, y: by.y / length };
  const stride = length / steps;
  let moved = 0;
  for (let i = 0; i < steps; i += 1) {
    const next = moved + stride;
    if (objectHitsAt(terrain, object, { x: unit.x * next, y: unit.y * next })) break;
    moved = next;
  }
  object.x += unit.x * moved;
  object.y += unit.y * moved;
  return moved;
}
