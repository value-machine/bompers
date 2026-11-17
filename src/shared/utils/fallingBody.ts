/**
 * Falling body: a circle that falls, bounces and rolls against solid terrain, queried through a
 * `solidAt(x, y)` point test (the arena grid's `isSolidAt` fits). Render-side physics for loose
 * things that do not take part in the game rules: a knocked-out blob, its goo droplets, a helmet
 * flying off (knockout feature). Built generic so later falling things (loose terrain chunks) can
 * reuse it. Pure; axis-separated like the player controller, so it never tunnels on a cell grid
 * as long as one step moves less than the radius plus a cell.
 */
import type { FallingBody, SolidAt } from "@/shared/types/fallingBody.types";

export type { FallingBody, SolidAt } from "@/shared/types/fallingBody.types";

export interface FallingStepArgs {
  dt: number;
  gravity: number;
  solidAt: SolidAt;
  /** Share of the speed into a surface that comes back out (0 = dead stop, 1 = no loss). */
  bounce: number;
  /** Share of the speed along a floor lost per contact. */
  friction: number;
}

/** The surface a step ran into: its outward normal, the speed into it and the touch point. */
export interface FallingContact {
  nx: -1 | 0 | 1;
  ny: -1 | 0 | 1;
  speed: number;
  x: number;
  y: number;
}

/** Points tested around the rim (plus the centre). */
const RIM_SAMPLES = 8;

/** True when the circle's centre or any of its rim samples lies in solid terrain. */
export function circleHitsSolid(
  solidAt: SolidAt,
  { x, y, radius }: { x: number; y: number; radius: number }
): boolean {
  if (solidAt(x, y)) return true;
  for (let i = 0; i < RIM_SAMPLES; i += 1) {
    const turn = (i / RIM_SAMPLES) * Math.PI * 2;
    if (solidAt(x + Math.cos(turn) * radius, y + Math.sin(turn) * radius)) return true;
  }
  return false;
}

const sign = (value: number): -1 | 0 | 1 => (value > 0 ? 1 : value < 0 ? -1 : 0);

/** Moves along one axis; on a hit stays put, bounces and returns the contact. */
function moveAxis(
  body: FallingBody,
  axis: "x" | "y",
  args: FallingStepArgs
): FallingContact | null {
  const velocity = axis === "x" ? body.vx : body.vy;
  const next = body[axis] + velocity * args.dt;
  const nx = axis === "x" ? next : body.x;
  const ny = axis === "y" ? next : body.y;
  if (!circleHitsSolid(args.solidAt, { x: nx, y: ny, radius: body.radius })) {
    body[axis] = next;
    return null;
  }
  const into = sign(velocity);
  const speed = Math.abs(velocity);
  if (axis === "x") body.vx = -velocity * args.bounce;
  else body.vy = -velocity * args.bounce;
  return {
    nx: axis === "x" ? (-into as -1 | 0 | 1) : 0,
    ny: axis === "y" ? (-into as -1 | 0 | 1) : 0,
    speed,
    x: body.x + (axis === "x" ? into * body.radius : 0),
    y: body.y + (axis === "y" ? into * body.radius : 0),
  };
}

/**
 * One step: gravity, then x, then y. Returns the harder of this step's contacts (null when it
 * touched nothing). On a floor the body loses `friction` of its sideways speed and rolls.
 */
export function stepFallingBody(body: FallingBody, args: FallingStepArgs): FallingContact | null {
  body.vy += args.gravity * args.dt;
  const side = moveAxis(body, "x", args);
  const vertical = moveAxis(body, "y", args);
  if (vertical && vertical.ny < 0) {
    body.vx *= 1 - args.friction;
    body.spin = body.vx / body.radius;
  }
  body.angle += body.spin * args.dt;
  if (!side) return vertical;
  if (!vertical) return side;
  return side.speed >= vertical.speed ? side : vertical;
}
