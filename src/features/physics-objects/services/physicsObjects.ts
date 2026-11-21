import type { Rect, Vec2 } from "@/shared/types/gameGeometry.types";
import type { GameTunables } from "@/shared/types/gameTunables.types";
import { boxShapeVersion, type TerrainGrid } from "@/features/arena/api/arenaApi";
import type { FireState } from "@/features/fire/api/fireApi";
import type { IceState } from "@/features/ice/api/iceApi";
import type { BlobFireState } from "@/features/blob-fire/api/blobFireApi";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import { findPhysicsVariant } from "@/features/level-objects/api/levelObjectsApi";
import type { PlayerState } from "@/features/player/api/playerApi";
import {
  freeStuckObject,
  objectHitsAt,
  stepObjectMotion,
} from "@/features/physics-objects/services/objectMotion";
import {
  bumpObjects,
  bumpObjectsAndBlobs,
  pushObjectsByBlasts,
  type ObjectBlast,
} from "@/features/physics-objects/services/objectContacts";
import {
  shatterOnHit,
  stepObjectElements,
  type MomentSink,
} from "@/features/physics-objects/services/objectElements";
import type {
  ObjectBlobContact,
  ObjectMoment,
  PhysicsObject,
  PhysicsObjectsState,
} from "@/features/physics-objects/types/physicsObject.types";

/**
 * Physics objects (physics-objects lap): the moving bodies a level places (`<rect
 * data-role="object">` of a physics kind, e.g. `ball`). One step: come back when due, move
 * through the terrain, bump each other and the blobs, take blasts, fire and frost (whole object),
 * then pop when stuck, burnt through or out of the arena. Pure TS, mutates its slice.
 */

/**
 * Sleeping (physics-objects D9, the common rigid-body practice): a ball resting on the ground
 * almost still for `SLEEP_AFTER_SECONDS` stops simulating its motion, which is most of its cost.
 * It wakes when it has speed again (a bump, blast or dive set it), when a moving part moved it
 * (`wakeObject`) or when the terrain under it changed (a crater, a burn-out).
 */
const SLEEP_AFTER_SECONDS = 0.25;
/** Slower than this (units / s) counts as still. */
const REST_SPEED = 4;

/** The terrain shape version of the chunks around an object (changes when terrain there does). */
function shapeUnder(object: PhysicsObject, terrain: TerrainGrid): number {
  const reach = (object.radius + terrain.cellSize * 2) / terrain.cellSize;
  const cx = object.x / terrain.cellSize;
  const cy = object.y / terrain.cellSize;
  return boxShapeVersion(terrain, {
    minX: cx - reach,
    minY: cy - reach,
    maxX: cx + reach,
    maxY: cy + reach,
  });
}

/** Wakes a sleeping object (something outside its own step moved it). */
export function wakeObject(object: PhysicsObject): void {
  object.sleepShape = null;
  object.restSeconds = 0;
}

/** Still asleep: no speed and the terrain under it unchanged; otherwise it wakes. */
function staysAsleep(object: PhysicsObject, terrain: TerrainGrid): boolean {
  if (object.sleepShape === null) return false;
  const still = Math.hypot(object.vx, object.vy) < REST_SPEED;
  if (still && shapeUnder(object, terrain) === object.sleepShape) return true;
  wakeObject(object);
  return false;
}

/** After its own motion: count rest on the ground and fall asleep once it lasted. */
function settle(object: PhysicsObject, step: { terrain: TerrainGrid; dt: number }): void {
  const still = object.grounded && Math.hypot(object.vx, object.vy) < REST_SPEED;
  object.restSeconds = still ? object.restSeconds + step.dt : 0;
  if (object.restSeconds < SLEEP_AFTER_SECONDS) return;
  object.vx = 0;
  object.vy = 0;
  object.sleepShape = shapeUnder(object, step.terrain);
}

/** Seconds a moment is kept for the renderer (longer than every effect it drives). */
const MOMENT_SECONDS = 1;
/** Bounces closer together than this on one object make one moment (rolling chatter). */
const BOUNCE_GAP_SECONDS = 0.12;

/** The objects a level placed, at rest in their rects (a ball rests on the rect's bottom). */
export function createPhysicsObjectsState(level: LevelDefinition): PhysicsObjectsState {
  const objects: PhysicsObject[] = [];
  (level.objects ?? []).forEach((placed) => {
    const variant = findPhysicsVariant(placed.kind, placed.variant);
    if (!variant) return;
    const radius = placed.box.h / 2;
    const home = { x: placed.box.x + placed.box.w / 2, y: placed.box.y + placed.box.h - radius };
    objects.push({
      id: `object-${objects.length}`,
      kind: placed.kind,
      variant: placed.variant,
      body: variant.body,
      radius,
      home,
      x: home.x,
      y: home.y,
      vx: 0,
      vy: 0,
      angle: 0,
      grounded: false,
      goneUntil: null,
      state: { kind: "none" },
      chill: 0,
      chilledAt: -Infinity,
      heldCarry: null,
      restSeconds: 0,
      sleepShape: null,
    });
  });
  return { objects, moments: [], momentCount: 0 };
}

/** Objects in play (not popped and waiting to come back). */
export const objectsInPlay = (state: PhysicsObjectsState): PhysicsObject[] =>
  state.objects.filter((object) => object.goneUntil === null);

/** Records a moment for the renderer and sound. */
function addMoment(
  state: PhysicsObjectsState,
  object: PhysicsObject,
  moment: Pick<ObjectMoment, "kind" | "soundId" | "atSeconds"> & { strength?: number; at?: Vec2 }
): void {
  state.moments.push({
    seq: state.momentCount,
    kind: moment.kind,
    objectId: object.id,
    at: moment.at ?? { x: object.x, y: object.y },
    atSeconds: moment.atSeconds,
    strength: moment.strength ?? 1,
    soundId: moment.soundId,
  });
  state.momentCount += 1;
}

const sinkFor =
  (state: PhysicsObjectsState, now: number): MomentSink =>
  (object, moment) =>
    addMoment(state, object, { ...moment, atSeconds: now });

/**
 * Pops an object (out of the arena, burnt through, stuck or pinned): it leaves play with a puff
 * and comes back at its spot `physicsObjects.respawnSeconds` later (owner Q2).
 */
export function popObject(
  state: PhysicsObjectsState,
  object: PhysicsObject,
  pop: { now: number; tunables: GameTunables; soundId: string }
): void {
  if (object.goneUntil !== null) return;
  addMoment(state, object, { kind: "pop", soundId: pop.soundId, atSeconds: pop.now });
  object.goneUntil = pop.now + pop.tunables.physicsObjects.respawnSeconds;
  object.state = { kind: "none" };
  object.chill = 0;
}

/** Objects whose time is up come back at their spot, at rest; one there in solid is freed. */
function bringBack(state: PhysicsObjectsState, step: { terrain: TerrainGrid; now: number }): void {
  for (const object of state.objects) {
    if (object.goneUntil === null || step.now < object.goneUntil) continue;
    Object.assign(object, { ...object.home, vx: 0, vy: 0, angle: 0, goneUntil: null });
    wakeObject(object);
    if (objectHitsAt(step.terrain, object, { x: 0, y: 0 })) freeStuckObject(object, step.terrain);
    addMoment(state, object, { kind: "back", soundId: "respawn", atSeconds: step.now });
  }
}

/** Gain of a bounce, 0–1, from its impact speed; null when too soft to be heard or seen. */
function bounceStrength(impact: number, tunables: GameTunables): number | null {
  const { bounceSoundMinSpeed: min, bounceSoundFullSpeed: full } = tunables.physicsObjects;
  if (impact < min) return null;
  return Math.min(1, (impact - min) / Math.max(1, full - min));
}

function lastBounceAt(state: PhysicsObjectsState, object: PhysicsObject): number {
  for (let i = state.moments.length - 1; i >= 0; i -= 1) {
    const moment = state.moments[i]!;
    if (moment.objectId === object.id && moment.kind === "bounce") return moment.atSeconds;
  }
  return -Infinity;
}

export interface StepPhysicsObjectsArgs {
  terrain: TerrainGrid;
  /** Players in play. */
  players: readonly PlayerState[];
  /** Leaving it pops the object (the match's kill zone). */
  killZone: Rect;
  /** This step's explosions. */
  blasts: readonly ObjectBlast[];
  fire: FireState;
  ice: IceState;
  blobFire: BlobFireState;
  isDiving: (player: PlayerState) => boolean;
  now: number;
  dt: number;
  tunables: GameTunables;
}

/** Motion through the terrain and the bounce moments it makes. */
function moveAll(
  state: PhysicsObjectsState,
  objects: readonly PhysicsObject[],
  args: StepPhysicsObjectsArgs
): Set<PhysicsObject> {
  const { terrain, tunables, dt, now } = args;
  const stuck = new Set<PhysicsObject>();
  for (const object of objects) {
    if (staysAsleep(object, terrain)) continue;
    const { impact, stuck: wedged } = stepObjectMotion(object, { terrain, tunables, dt });
    if (wedged) stuck.add(object);
    else settle(object, { terrain, dt });
    const strength = bounceStrength(impact, tunables);
    if (strength === null || now - lastBounceAt(state, object) < BOUNCE_GAP_SECONDS) continue;
    addMoment(state, object, {
      kind: "bounce",
      soundId: object.body.bounceSound,
      strength,
      atSeconds: now,
      at: { x: object.x, y: object.y + object.radius },
    });
  }
  return stuck;
}

/** Bumps, blasts and dives; hits break frozen objects' ice. Returns the blob contacts. */
function pushAll(
  state: PhysicsObjectsState,
  objects: readonly PhysicsObject[],
  args: StepPhysicsObjectsArgs
): ObjectBlobContact[] {
  const { terrain, tunables, now } = args;
  const sink = sinkFor(state, now);
  bumpObjects(objects, { terrain, tunables });
  const contacts = bumpObjectsAndBlobs({
    objects,
    players: args.players,
    terrain,
    tunables,
    isDiving: args.isDiving,
  });
  for (const object of pushObjectsByBlasts(objects, { blasts: args.blasts, tunables })) {
    shatterOnHit(object, sink);
  }
  for (const contact of contacts) if (contact.dived) shatterOnHit(contact.object, sink);
  return contacts;
}

const outside = (zone: Rect, p: Vec2): boolean =>
  p.x < zone.x || p.x > zone.x + zone.w || p.y < zone.y || p.y > zone.y + zone.h;

/** One step of every physics object (match step 3g, after combat). */
export function stepPhysicsObjects(state: PhysicsObjectsState, args: StepPhysicsObjectsArgs): void {
  const { terrain, tunables, now } = args;
  state.moments = state.moments.filter((moment) => now - moment.atSeconds <= MOMENT_SECONDS);
  bringBack(state, { terrain, now });
  const objects = objectsInPlay(state);
  if (objects.length === 0) return;
  // Only motion can leave an object in solid (bumps and blasts move it safely or set speeds).
  const stuck = moveAll(state, objects, args);
  const contacts = pushAll(state, objects, args);
  const burnt = stepObjectElements({
    ...args,
    objects,
    contacts,
    sink: sinkFor(state, now),
  });
  for (const object of burnt) popObject(state, object, { now, tunables, soundId: "burn-out" });
  for (const object of objects) {
    if (object.goneUntil !== null) continue;
    if (outside(args.killZone, object)) {
      popObject(state, object, { now, tunables, soundId: "none" });
    } else if (stuck.has(object) && !freeStuckObject(object, terrain)) {
      popObject(state, object, { now, tunables, soundId: "thwap" });
    }
  }
}
