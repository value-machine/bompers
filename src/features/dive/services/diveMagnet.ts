import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { Vec2 } from "@/shared/types/gameGeometry.types";
import type { PlayerState } from "@/features/player/api/playerApi";

/**
 * Dash aim magnetism (owner pick B, dash-aim lap). A headbutt only lands when the two body
 * centres pass within one body width, so a dash locked at the press missed targets between two of
 * the 16 directions and anything moving sideways during the wind-up and travel. At the press, the
 * other blob the aim points at (within `dive.magnet.coneDegrees` and `range`) bends the dash to
 * where it will be when the dash arrives: its velocity plus gravity over that time. The dash
 * itself stays dead straight. Pure; the dive sim calls it once per dive start.
 */
export interface MagnetArgs {
  dasher: PlayerState;
  /** The dash direction snapped to 16 ways, used when no target is in the cone. */
  snapped: Vec2;
  /** Every player in play; the dasher itself is skipped. */
  players: readonly PlayerState[];
  tunables: GameTunables;
}

interface Candidate {
  target: PlayerState;
  distance: number;
  /** Radians between the aim and the target as it stands now (what the player sees). */
  offAim: number;
}

const angleBetween = (a: number, b: number): number =>
  Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

/** The blob closest to the aim line inside the cone and range, or null. */
function pickTarget(args: MagnetArgs): Candidate | null {
  const { dasher, players, tunables } = args;
  const { coneDegrees, range } = tunables.dive.magnet;
  const cone = (coneDegrees * Math.PI) / 180;
  const aim = Math.atan2(dasher.aimY, dasher.aimX);
  let best: Candidate | null = null;
  for (const target of players) {
    if (target.id === dasher.id) continue;
    const dx = target.x - dasher.x;
    const dy = target.y - dasher.y;
    const distance = Math.hypot(dx, dy);
    const offAim = angleBetween(Math.atan2(dy, dx), aim);
    if (distance > range || offAim > cone) continue;
    if (!best || offAim < best.offAim) best = { target, distance, offAim };
  }
  return best;
}

/**
 * Where the target will be when the dash reaches it: wind-up plus travel time at launch speed,
 * its velocity and (in the air) gravity over that time.
 */
function leadPoint(candidate: Candidate, tunables: GameTunables): Vec2 {
  const { target, distance } = candidate;
  const t = tunables.dive.windupSeconds + distance / tunables.dive.launchSpeed;
  const gravity = target.grounded ? 0 : tunables.world.gravity * target.gravityScale;
  return { x: target.x + target.vx * t, y: target.y + target.vy * t + 0.5 * gravity * t * t };
}

/** The dash direction: toward a magnet target's lead point, else the snapped aim. */
export function magnetDirection(args: MagnetArgs): Vec2 {
  const candidate = pickTarget(args);
  if (!candidate) return args.snapped;
  const lead = leadPoint(candidate, args.tunables);
  const dx = lead.x - args.dasher.x;
  const dy = lead.y - args.dasher.y;
  const length = Math.hypot(dx, dy);
  return length > 1e-6 ? { x: dx / length, y: dy / length } : args.snapped;
}
