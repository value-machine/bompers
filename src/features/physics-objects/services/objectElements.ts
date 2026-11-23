import type { Vec2 } from "@/shared/types/gameGeometry.types";
import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { TerrainGrid } from "@/features/arena/api/arenaApi";
import { burningCount, type FireState } from "@/features/fire/api/fireApi";
import type { IceState } from "@/features/ice/api/iceApi";
import {
  burningGroundNear,
  catchFire,
  isBurning,
  type BlobFireState,
} from "@/features/blob-fire/api/blobFireApi";
import type { PlayerState } from "@/features/player/api/playerApi";
import type {
  ObjectBlobContact,
  ObjectMoment,
  PhysicsObject,
} from "@/features/physics-objects/types/physicsObject.types";

/**
 * Fire and frost on physics objects, always the whole object (owner, level-objects "object
 * classes"; physics-objects Q3, Q4). Reads the fire and ice slices (this step's torch sprays and
 * freeze rays, burning ground) and writes only the objects and burning blobs, so the terrain
 * fire and ice systems are untouched:
 * - **catches** from a torch ray through it, burning ground it touches, or a burning blob it
 *   touches; burns `body.burnSeconds`, then burns through and pops (a body with no burn time
 *   never catches);
 * - **lights blobs only** (Q3): a burning object sets a blob it touches alight, never the ground;
 * - **freezes** after `ice.blob.freezeSeconds` of freeze beam, like a blob (chill drains after
 *   `chillHoldSeconds` without beam); frozen it slides and does not spin (Q4) until a hit breaks
 *   the ice or `ice.blob.frozenSeconds` pass;
 * - fire and ice cancel (ice-frozen-blobs D6): a freeze ray puts a burning object out, a torch
 *   melts a frozen one.
 */

export type MomentSink = (
  object: PhysicsObject,
  moment: Pick<ObjectMoment, "kind" | "soundId"> & { strength?: number; at?: Vec2 }
) => void;

/** Shortest distance from `p` to the segment `a`–`b`. */
function segmentDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length2 = dx * dx + dy * dy;
  const t =
    length2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2)) : 0;
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

/** The first ray (origin → each end) passing through the object, or false. */
const rayReaches = (
  object: PhysicsObject,
  beam: { origin: Vec2; ends: readonly Vec2[] }
): boolean => beam.ends.some((end) => segmentDistance(object, beam.origin, end) <= object.radius);

/** Whether a freeze-ray puff in flight is inside the object (the cold travels with the puffs). */
const puffReaches = (object: PhysicsObject, puffs: readonly Vec2[]): boolean =>
  puffs.some((puff) => Math.hypot(puff.x - object.x, puff.y - object.y) <= object.radius);

const burns = (object: PhysicsObject): boolean => object.body.burnSeconds !== null;

function light(
  object: PhysicsObject,
  at: { now: number; bySlot: number | null },
  sink: MomentSink
) {
  if (!burns(object) || object.state.kind === "burning") return;
  if (object.state.kind === "frozen") {
    // A flame on the ice melts it instead (fire and ice cancel).
    object.state = { kind: "none" };
    sink(object, { kind: "melt", soundId: "steam-hiss" });
    return;
  }
  object.state = { kind: "burning", since: at.now, bySlot: at.bySlot };
  sink(object, { kind: "caught", soundId: "catch-fire" });
}

export interface ObjectElementsArgs {
  objects: readonly PhysicsObject[];
  fire: FireState;
  ice: IceState;
  blobFire: BlobFireState;
  terrain: TerrainGrid;
  players: readonly PlayerState[];
  contacts: readonly ObjectBlobContact[];
  now: number;
  dt: number;
  tunables: GameTunables;
  sink: MomentSink;
}

/** Catching: torch rays, burning ground, burning blobs touching it. */
function catchFlames(args: ObjectElementsArgs): void {
  const { now, terrain, sink } = args;
  // No search for burning ground near each object while nothing burns (most steps).
  const groundBurning = burningCount(args.fire) > 0;
  for (const object of args.objects) {
    const spray = args.fire.sprays.find((beam) => rayReaches(object, beam));
    if (spray) light(object, { now, bySlot: spray.slot }, sink);
    if (object.state.kind === "burning" || !burns(object) || !groundBurning) continue;
    const reach = object.radius + terrain.cellSize;
    if (burningGroundNear(args.fire, terrain, { world: object, reach, now })) {
      light(object, { now, bySlot: null }, sink);
    }
  }
  for (const contact of args.contacts) {
    const player = args.players.find((candidate) => candidate.id === contact.playerId);
    if (player && isBurning(args.blobFire, player)) {
      light(contact.object, { now, bySlot: player.slot }, sink);
    }
  }
}

/** A burning object sets the blobs it touches alight (owner Q3: blobs only, never the ground). */
function lightBlobs(args: ObjectElementsArgs): void {
  for (const contact of args.contacts) {
    const { state } = contact.object;
    if (state.kind !== "burning") continue;
    const player = args.players.find((candidate) => candidate.id === contact.playerId);
    if (!player) continue;
    catchFire(args.blobFire, player, {
      now: args.now,
      fromX: contact.object.x,
      bySlot: state.bySlot,
    });
  }
}

/** Chill drains after `chillHoldSeconds` without puffs; true when a freeze-ray puff reaches it now. */
function underRay(object: PhysicsObject, args: ObjectElementsArgs): boolean {
  if (args.ice.sprays.some((spray) => puffReaches(object, spray.stream.puffs))) {
    object.chilledAt = args.now;
    return true;
  }
  if (args.now - object.chilledAt > args.tunables.ice.blob.chillHoldSeconds) object.chill = 0;
  return false;
}

/** One object under this step's freeze rays: chill builds like a blob's; burning is put out. */
function chillObject(object: PhysicsObject, args: ObjectElementsArgs): void {
  const { now, sink } = args;
  if (!underRay(object, args) || object.state.kind === "frozen") return;
  if (object.state.kind === "burning") {
    object.state = { kind: "none" };
    sink(object, { kind: "melt", soundId: "steam-hiss" });
    return;
  }
  object.chill += args.dt;
  if (object.chill < args.tunables.ice.blob.freezeSeconds) return;
  object.chill = 0;
  object.state = { kind: "frozen", since: now };
  sink(object, { kind: "frozen", soundId: "freeze-solid" });
}

const chillObjects = (args: ObjectElementsArgs): void => {
  for (const object of args.objects) chillObject(object, args);
};

/** Burnt through (pops) or thawed out (the ice breaks) on time. Returns the burnt-through ones. */
function endOnTime(args: ObjectElementsArgs): PhysicsObject[] {
  const { now, sink } = args;
  const burnt: PhysicsObject[] = [];
  for (const object of args.objects) {
    const { state } = object;
    if (state.kind === "burning" && now - state.since >= (object.body.burnSeconds ?? Infinity)) {
      burnt.push(object);
    } else if (
      state.kind === "frozen" &&
      now - state.since >= args.tunables.ice.blob.frozenSeconds
    ) {
      object.state = { kind: "none" };
      sink(object, { kind: "shatter", soundId: "ice-shatter" });
    }
  }
  return burnt;
}

/** One step of fire and frost on the objects in play. Returns the ones that burnt through. */
export function stepObjectElements(args: ObjectElementsArgs): PhysicsObject[] {
  chillObjects(args);
  catchFlames(args);
  lightBlobs(args);
  return endOnTime(args);
}

/** A hit (blast, dive) breaks a frozen object's ice at once (Q4). */
export function shatterOnHit(object: PhysicsObject, sink: MomentSink): void {
  if (object.state.kind !== "frozen") return;
  object.state = { kind: "none" };
  sink(object, { kind: "shatter", soundId: "ice-shatter" });
}
