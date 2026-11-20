import type { Vec2 } from "@/shared/types/gameGeometry.types";
import type { GameTunables } from "@/shared/types/gameTunables.types";
import { blastHitPushAt } from "@/shared/utils/blastPower";
import type { TerrainGrid } from "@/features/arena/api/arenaApi";
import { moveAxis, type PlayerState } from "@/features/player/api/playerApi";
import { moveObjectSafely } from "@/features/physics-objects/services/objectMotion";
import type {
  ObjectBlobContact,
  PhysicsObject,
} from "@/features/physics-objects/types/physicsObject.types";

/**
 * Pushes on physics objects (physics-objects D2): blob bumps, object-on-object bumps and blasts.
 * A bump is the blob-vs-blob response (`player/bodyCollision.ts`) weighted by mass (a blob = 1).
 * **The object always gives way:** the overlap is taken out of the object first, with a move that
 * never enters terrain; only what it could not take moves the blob, with the blob's own terrain-
 * safe move. An object is never terrain to a blob, so it can never trap one (owner never-stuck).
 */

const blobCenter = (player: PlayerState): Vec2 => ({
  x: player.x,
  y: player.y - player.height / 2,
});
const blobRadius = (player: PlayerState): number => player.width / 2;

/** Unit vector from `a` to `b`; straight up when they coincide. */
function unitFrom(a: Vec2, b: Vec2): { normal: Vec2; distance: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1e-6) return { normal: { x: 0, y: -1 }, distance: 0 };
  return { normal: { x: dx / distance, y: dy / distance }, distance };
}

export interface BlobBumpArgs {
  objects: readonly PhysicsObject[];
  players: readonly PlayerState[];
  terrain: TerrainGrid;
  tunables: GameTunables;
  /** A blob winding up or travelling in a dive kicks harder (`physicsObjects.divePush`). */
  isDiving: (player: PlayerState) => boolean;
}

/** Equal-and-opposite response along `normal` (blob → object); a blocked blob does not give. */
function bumpVelocities(
  object: PhysicsObject,
  player: PlayerState,
  ctx: { normal: Vec2; tunables: GameTunables }
): boolean {
  const { normal, tunables } = ctx;
  const closing = (player.vx - object.vx) * normal.x + (player.vy - object.vy) * normal.y;
  if (closing <= 0) return false;
  const bounce = closing < tunables.bodyCollision.restingSpeed ? 0 : object.body.restitution;
  // A blob standing on ground with the object pressing down on it cannot give way.
  const blobBlocked = player.grounded && normal.y < -0.5;
  const blobShare = blobBlocked ? 0 : 1;
  const impulse = ((1 + bounce) * closing) / (blobShare + 1 / object.body.mass);
  const blobChange = Math.min(impulse * blobShare, tunables.bodyCollision.maxImpulse);
  object.vx += (normal.x * impulse) / object.body.mass;
  object.vy += (normal.y * impulse) / object.body.mass;
  player.vx -= normal.x * blobChange;
  player.vy -= normal.y * blobChange;
  return true;
}

/** Separates a touching pair: the object moves first; the blob takes only what is left. */
function separate(
  object: PhysicsObject,
  player: PlayerState,
  ctx: { normal: Vec2; overlap: number; terrain: TerrainGrid; tunables: GameTunables }
): void {
  const { normal, overlap, terrain } = ctx;
  const moved = moveObjectSafely(object, { x: normal.x * overlap, y: normal.y * overlap }, terrain);
  const left = overlap - moved;
  if (left <= 1e-3) return;
  const contact = { terrain, slope: ctx.tunables.player.slope };
  moveAxis(player, { axis: "x", delta: -normal.x * left }, contact);
  moveAxis(player, { axis: "y", delta: -normal.y * left }, contact);
}

/** One blob touching one object: bump, dive kick, separation; the contact, or null. */
function bumpPair(
  object: PhysicsObject,
  player: PlayerState,
  args: BlobBumpArgs
): ObjectBlobContact | null {
  const { terrain, tunables } = args;
  const { normal, distance } = unitFrom(blobCenter(player), object);
  const overlap = blobRadius(player) + object.radius - distance;
  if (overlap <= 0) return null;
  const dived = bumpVelocities(object, player, { normal, tunables }) && args.isDiving(player);
  if (dived) {
    const kick = tunables.physicsObjects.divePush / object.body.mass;
    object.vx += normal.x * kick;
    object.vy += normal.y * kick;
  }
  separate(object, player, { normal, overlap, terrain, tunables });
  const reach = blobRadius(player) - overlap / 2;
  const center = blobCenter(player);
  const at = { x: center.x + normal.x * reach, y: center.y + normal.y * reach };
  return { object, playerId: player.id, at, dived };
}

/** Every blob touching an object: bump, dive kick, separation. Returns the contacts. */
export function bumpObjectsAndBlobs(args: BlobBumpArgs): ObjectBlobContact[] {
  return args.objects.flatMap((object) =>
    args.players.flatMap((player) => bumpPair(object, player, args) ?? [])
  );
}

/** Two objects touching bounce by weight and step apart (each its share, never into terrain). */
function bumpObjectPair(a: PhysicsObject, b: PhysicsObject, terrain: TerrainGrid): void {
  const { normal, distance } = unitFrom(a, b);
  const overlap = a.radius + b.radius - distance;
  if (overlap <= 0) return;
  const closing = (a.vx - b.vx) * normal.x + (a.vy - b.vy) * normal.y;
  const inverse = 1 / a.body.mass + 1 / b.body.mass;
  if (closing > 0) {
    const impulse = ((1 + Math.min(a.body.restitution, b.body.restitution)) * closing) / inverse;
    a.vx -= (normal.x * impulse) / a.body.mass;
    a.vy -= (normal.y * impulse) / a.body.mass;
    b.vx += (normal.x * impulse) / b.body.mass;
    b.vy += (normal.y * impulse) / b.body.mass;
  }
  const away = overlap / a.body.mass / inverse;
  moveObjectSafely(a, { x: -normal.x * away, y: -normal.y * away }, terrain);
  const rest = overlap - away;
  moveObjectSafely(b, { x: normal.x * rest, y: normal.y * rest }, terrain);
}

/** Objects touching each other bounce by weight and step apart. */
export function bumpObjects(
  objects: readonly PhysicsObject[],
  ctx: { terrain: TerrainGrid; tunables: GameTunables }
): void {
  for (let i = 0; i < objects.length; i += 1) {
    for (let k = i + 1; k < objects.length; k += 1)
      bumpObjectPair(objects[i]!, objects[k]!, ctx.terrain);
  }
}

/** One explosion this step, as the objects feel it. */
export interface ObjectBlast {
  at: Vec2;
  power: number;
}

/**
 * Blasts push objects like a hit blob (`blastHitPushAt` at the distance to the object's surface),
 * divided by its weight. Returns the objects a blast reached (a hit breaks a frozen one's ice).
 */
export function pushObjectsByBlasts(
  objects: readonly PhysicsObject[],
  ctx: { blasts: readonly ObjectBlast[]; tunables: GameTunables }
): Set<PhysicsObject> {
  const reached = new Set<PhysicsObject>();
  for (const blast of ctx.blasts) {
    for (const object of objects) {
      const { normal, distance } = unitFrom(blast.at, object);
      const push = blastHitPushAt(ctx.tunables, blast.power, Math.max(0, distance - object.radius));
      if (push <= 0) continue;
      object.vx += (normal.x * push) / object.body.mass;
      object.vy += (normal.y * push) / object.body.mass;
      reached.add(object);
    }
  }
  return reached;
}
