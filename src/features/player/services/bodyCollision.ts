import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { Vec2 } from "@/shared/types/gameGeometry.types";
import type { TerrainGrid } from "@/features/arena/api/arenaApi";
import type { PlayerState } from "@/features/player/types/player.types";
import { moveAxis } from "@/features/player/services/playerController";

/**
 * Blob-vs-blob contact (sim step 2b, right after `stepPlayers`). Bodies are circles of equal
 * mass; terrain keeps the box. For each overlapping pair:
 *
 *   n  = unit vector from a's centre to b's centre (the contact normal)
 *   c  = (va − vb) · n            closing speed (> 0 = approaching)
 *   j  = min((1 + e) / 2 · c, maxImpulse)
 *   va −= j·n,  vb += j·n
 *
 * With e = 1 the normal velocities swap: a symmetric head-on meeting reflects both equally, and
 * a moving blob hitting a resting one hands its speed over. A blob that cannot give way
 * (standing on ground, pushed downward) counts as immovable, so the other one bounces off it.
 * Positions are separated with the controller's terrain-safe move, never into terrain.
 */
export interface BodyContact {
  /** The pair, in player-list order. */
  a: PlayerState;
  b: PlayerState;
  /** Unit normal from a's centre to b's centre. */
  normal: Vec2;
  /** Contact point (midway between the two surfaces), world units. */
  at: Vec2;
  /** Each blob's speed toward the other before the response, units / s (negative = moving away). */
  aApproachSpeed: number;
  bApproachSpeed: number;
  /** Velocity change the response gave each blob along the normal (0 when not closing). */
  impulse: number;
}

export interface ResolveBodyContactsArgs {
  players: PlayerState[];
  terrain: TerrainGrid;
  tunables: GameTunables;
}

const bodyRadius = (player: PlayerState): number => player.width / 2;
const centerY = (player: PlayerState): number => player.y - player.height / 2;

/** Normal from a to b; exactly coincident centres separate along x, in list order. */
function contactNormal(a: PlayerState, b: PlayerState): { normal: Vec2; distance: number } {
  const dx = b.x - a.x;
  const dy = centerY(b) - centerY(a);
  const distance = Math.hypot(dx, dy);
  if (distance < 1e-6) return { normal: { x: 1, y: 0 }, distance: 0 };
  return { normal: { x: dx / distance, y: dy / distance }, distance };
}

/** Standing on ground and pushed downward: this blob cannot give way along `push`. */
const isBlocked = (player: PlayerState, push: Vec2): boolean => player.grounded && push.y > 0.5;

/** Moves both blobs apart by the overlap (half each, all of it for one if the other is blocked). */
function separate(contact: BodyContact, overlap: number, terrain: TerrainGrid): void {
  const { a, b, normal } = contact;
  const aBlocked = isBlocked(a, { x: -normal.x, y: -normal.y });
  const bBlocked = isBlocked(b, normal);
  const aShare = aBlocked ? 0 : bBlocked ? 1 : 0.5;
  const bShare = bBlocked ? 0 : aBlocked ? 1 : 0.5;
  moveAxis(a, { axis: "x", delta: -normal.x * overlap * aShare }, terrain);
  moveAxis(a, { axis: "y", delta: -normal.y * overlap * aShare }, terrain);
  moveAxis(b, { axis: "x", delta: normal.x * overlap * bShare }, terrain);
  moveAxis(b, { axis: "y", delta: normal.y * overlap * bShare }, terrain);
}

/** Applies the equal-mass response; returns the velocity change along the normal. */
function respond(contact: BodyContact, tunables: GameTunables["bodyCollision"]): number {
  const { a, b, normal } = contact;
  const closing = contact.aApproachSpeed + contact.bApproachSpeed;
  if (closing <= 0) return 0;
  const restitution = closing < tunables.restingSpeed ? 0 : tunables.restitution;
  const aBlocked = isBlocked(a, { x: -normal.x, y: -normal.y });
  const bBlocked = isBlocked(b, normal);
  // Against an immovable blob the mover takes the whole (1 + e)·c instead of half of it.
  const full = Math.min((1 + restitution) * closing, tunables.maxImpulse);
  const half = Math.min(((1 + restitution) / 2) * closing, tunables.maxImpulse);
  const aChange = aBlocked ? 0 : bBlocked ? full : half;
  const bChange = bBlocked ? 0 : aBlocked ? full : half;
  a.vx -= normal.x * aChange;
  a.vy -= normal.y * aChange;
  b.vx += normal.x * bChange;
  b.vy += normal.y * bChange;
  return Math.max(aChange, bChange);
}

/** The contact between two blobs this step, or null when they do not touch. */
function contactBetween(
  a: PlayerState,
  b: PlayerState
): (BodyContact & { overlap: number }) | null {
  const { normal, distance } = contactNormal(a, b);
  const overlap = bodyRadius(a) + bodyRadius(b) - distance;
  if (overlap <= 0) return null;
  const reach = bodyRadius(a) - overlap / 2;
  return {
    a,
    b,
    normal,
    at: { x: a.x + normal.x * reach, y: centerY(a) + normal.y * reach },
    aApproachSpeed: a.vx * normal.x + a.vy * normal.y,
    bApproachSpeed: -(b.vx * normal.x + b.vy * normal.y),
    impulse: 0,
    overlap,
  };
}

/**
 * Resolves every touching pair once and returns the contacts, so later systems (the dive) can
 * read who ran into whom. Mutates positions and velocities in place.
 */
export function resolveBodyContacts(args: ResolveBodyContactsArgs): BodyContact[] {
  const { players, terrain, tunables } = args;
  const contacts: BodyContact[] = [];
  for (let i = 0; i < players.length; i += 1) {
    for (let k = i + 1; k < players.length; k += 1) {
      const found = contactBetween(players[i]!, players[k]!);
      if (!found) continue;
      const { overlap, ...contact } = found;
      contact.impulse = respond(contact, tunables.bodyCollision);
      separate(contact, overlap, terrain);
      contacts.push(contact);
    }
  }
  return contacts;
}
