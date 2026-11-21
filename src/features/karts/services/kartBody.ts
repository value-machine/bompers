import type { Vec2 } from "@/shared/types/gameGeometry.types";
import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { TerrainGrid } from "@/features/arena/api/arenaApi";
import { moveObjectSafely, wakeObject } from "@/features/physics-objects/api/physicsObjectsApi";
import type { ChassisShape, Kart } from "@/features/karts/services/kartModel";

/**
 * A kart's body (kart lap K2): its two wheels are held apart at the wheel base (a stiff rod,
 * moved only by terrain-safe moves), and the chassis rides above the axle line on a damped
 * spring that lags behind the axle's speed changes: landing sinks it, a hop leaves it behind,
 * then it settles. Driving pushes the grounded wheels along the axle line. Pure TS, mutates.
 */

/** Below this the axle line is degenerate (wheels on top of each other): keep the last one. */
const MIN_AXLE = 1e-3;
/** A speed change bigger than this in one step is a teleport (came back), not a jolt. */
const MAX_JOLT = 2000;
/** The chassis bottom sits this far above the wheel centres, × wheel radius. */
const CHASSIS_LIFT = 0.25;

export const wheelRadiusOf = (kart: Pick<Kart, "body" | "height">): number =>
  kart.body.wheelRadius * kart.height;

const wheelBaseOf = (kart: Kart): number => kart.body.wheelSpread * kart.length * 2;

const thicknessOf = (kart: Pick<Kart, "body" | "height">): number =>
  kart.body.chassisHeight * kart.height;

/** Middle of the axle line and the speed of that middle. */
export function axleOf(kart: Kart): { mid: Vec2; velocity: Vec2 } {
  const [a, b] = kart.wheels;
  return {
    mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    velocity: { x: (a.vx + b.vx) / 2, y: (a.vy + b.vy) / 2 },
  };
}

/** Unit vector from wheel 0 to wheel 1 (level when they coincide). */
function alongOf(kart: Kart): Vec2 {
  const [a, b] = kart.wheels;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  return length < MIN_AXLE ? { x: 1, y: 0 } : { x: dx / length, y: dy / length };
}

/** Where the chassis is now: its rest place above the axle plus the spring's lag. */
export function chassisOf(kart: Kart): ChassisShape {
  const along = alongOf(kart);
  const up = { x: along.y, y: -along.x };
  const radius = thicknessOf(kart) / 2;
  const lift = wheelRadiusOf(kart) * CHASSIS_LIFT + radius;
  const { mid } = axleOf(kart);
  return {
    center: {
      x: mid.x + up.x * lift + kart.spring.x,
      y: mid.y + up.y * lift + kart.spring.y,
    },
    along,
    up,
    halfLength: Math.max(0, kart.length / 2 - radius),
    radius,
  };
}

/** Nearest point of the chassis capsule's core segment to `p`. */
export function nearestOnChassis(chassis: ChassisShape, p: Vec2): Vec2 {
  const { center, along, halfLength } = chassis;
  const t = (p.x - center.x) * along.x + (p.y - center.y) * along.y;
  const k = Math.max(-halfLength, Math.min(halfLength, t));
  return { x: center.x + along.x * k, y: center.y + along.y * k };
}

/**
 * Holds the wheels at the wheel base: each moves half the error along the axle line (never into
 * terrain) and their speeds along it are evened out, so the kart moves as one.
 */
export function holdWheels(kart: Kart, terrain: TerrainGrid): void {
  const [a, b] = kart.wheels;
  const along = alongOf(kart);
  const gap = Math.hypot(b.x - a.x, b.y - a.y) - wheelBaseOf(kart);
  if (Math.abs(gap) > 1e-3) {
    const half = gap / 2;
    moveObjectSafely(a, { x: along.x * half, y: along.y * half }, terrain);
    moveObjectSafely(b, { x: -along.x * half, y: -along.y * half }, terrain);
  }
  const va = a.vx * along.x + a.vy * along.y;
  const vb = b.vx * along.x + b.vy * along.y;
  const even = (va + vb) / 2;
  a.vx += (even - va) * along.x;
  a.vy += (even - va) * along.y;
  b.vx += (even - vb) * along.x;
  b.vy += (even - vb) * along.y;
}

/**
 * The chassis spring: it keeps its own speed when the axle's changes (a landing stops the axle,
 * the chassis carries on down), pulled back to rest by a damped spring and kept within its
 * travel. Settles in about a third of a second (`JUICE_WINDOWS.settle`).
 */
export function stepSpring(kart: Kart, step: { dt: number; tunables: GameTunables }): void {
  const { velocity } = axleOf(kart);
  const jolt = { x: velocity.x - kart.axleVelocity.x, y: velocity.y - kart.axleVelocity.y };
  kart.axleVelocity = velocity;
  if (Math.hypot(jolt.x, jolt.y) < MAX_JOLT) kickSpring(kart, { x: -jolt.x, y: -jolt.y });
  const w = kart.body.springRate;
  const c = 2 * kart.body.springDamping * w;
  const { spring, springVelocity: v } = kart;
  v.x += (-w * w * spring.x - c * v.x) * step.dt;
  v.y += (-w * w * spring.y - c * v.y) * step.dt;
  spring.x += v.x * step.dt;
  spring.y += v.y * step.dt;
  keepInTravel(kart, step.tunables.karts.springTravel * kart.height);
}

/** The chassis stops at the end of its travel (no speed further out). */
function keepInTravel(kart: Kart, travel: number): void {
  const { spring, springVelocity: v } = kart;
  const out = Math.hypot(spring.x, spring.y);
  if (out <= travel) return;
  spring.x *= travel / out;
  spring.y *= travel / out;
  const outward = (v.x * spring.x + v.y * spring.y) / travel;
  if (outward <= 0) return;
  v.x -= (outward * spring.x) / travel;
  v.y -= (outward * spring.y) / travel;
}

/** Kicks the chassis on its spring (getting in sinks it, getting out lets it spring up). */
export function kickSpring(kart: Kart, by: Vec2): void {
  kart.springVelocity.x += by.x;
  kart.springVelocity.y += by.y;
}

const approach = (value: number, target: number, step: number): number =>
  value < target ? Math.min(target, value + step) : Math.max(target, value - step);

/** Both wheels toward the stick's speed along the axle line (the kart faces the way it drives). */
function drive(kart: Kart, moveX: number, dt: number): void {
  const along = alongOf(kart);
  kart.facing = moveX > 0 ? 1 : -1;
  const target = moveX * kart.body.driveSpeed;
  for (const wheel of kart.wheels) {
    const speed = wheel.vx * along.x + wheel.vy * along.y;
    const next = approach(speed, target, kart.body.driveAccel * dt);
    wheel.vx += (next - speed) * along.x;
    wheel.vy += (next - speed) * along.y;
    wakeObject(wheel);
  }
}

export interface DriveInput {
  /** The driver's stick, -1 … 1. */
  moveX: number;
  /** Jump pressed this step. */
  hop: boolean;
}

/**
 * The driver's input on the kart (owner Q2): left / right drive the grounded wheels along the
 * axle line toward `driveSpeed`; with no stick they coast (roll drag). A hop needs a wheel on the
 * ground and lifts both. A frozen kart slides on (no grip). Returns whether it hopped.
 */
export function driveKart(kart: Kart, input: DriveInput, dt: number): boolean {
  if (kart.state.kind === "frozen") return false;
  const grounded = kart.wheels.some((wheel) => wheel.grounded);
  if (!grounded) return false;
  if (Math.abs(input.moveX) > 0.1) drive(kart, input.moveX, dt);
  if (!input.hop) return false;
  for (const wheel of kart.wheels) {
    wheel.vy = Math.min(wheel.vy, -kart.body.hopSpeed);
    wakeObject(wheel);
  }
  return true;
}
