import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { PlayerInput, PlayerInputs } from "@/shared/types/gameInput.types";
import type { TerrainGrid } from "@/features/arena/api/arenaApi";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import { findPhysicsVariant } from "@/features/level-objects/api/levelObjectsApi";
import type { PlayerState } from "@/features/player/api/playerApi";
import {
  addMoment,
  addRoundBody,
  popObject,
  type PhysicsObject,
  type PhysicsObjectsState,
} from "@/features/physics-objects/api/physicsObjectsApi";
import type { KartBodySpec } from "@/shared/types/physicsBody.types";
import {
  axleOf,
  chassisOf,
  driveKart,
  holdWheels,
  stepSpring,
  wheelRadiusOf,
} from "@/features/karts/services/kartBody";
import { ejectDriver, kartInPlay, seatDrivers } from "@/features/karts/services/kartSeats";
import { bumpKartsAndBlobs, type KartHit } from "@/features/karts/services/kartContacts";
import type { Kart, KartsState } from "@/features/karts/services/kartModel";

/**
 * Karts (kart lap): drivable physics objects a level places (`<rect data-role="object"
 * data-kind="kart">`). The wheels are physics-objects round bodies, so they fall, roll, bump,
 * ride moving parts, take blasts, fire and frost and pop there; this feature holds them together,
 * springs the chassis, drives, seats drivers, keeps fire and frost whole across the kart and turns
 * fast contacts into hits. Pure TS, mutates its slice and the wheels.
 */

/** Wheel bodies of a kart variant: its feel, half its weight each (kart K2). */
const wheelBody = (body: KartBodySpec) =>
  ({
    shape: "wheel",
    mass: body.mass / 2,
    restitution: body.restitution,
    rollDrag: body.rollDrag,
    burnSeconds: body.burnSeconds,
    bounceSound: body.bounceSound,
  }) as const;

/** The karts a level placed, their wheels added to the physics objects at rest in the rect. */
export function createKartsState(level: LevelDefinition, physics: PhysicsObjectsState): KartsState {
  const karts: Kart[] = [];
  for (const placed of level.objects ?? []) {
    const body = findPhysicsVariant(placed.kind, placed.variant)?.body;
    if (body?.shape !== "kart") continue;
    const { box } = placed;
    const radius = wheelRadiusOf({ body, height: box.h });
    const centerX = box.x + box.w / 2;
    const spread = body.wheelSpread * box.w;
    const wheelAt = (side: number): PhysicsObject =>
      addRoundBody(physics, {
        kind: placed.kind,
        variant: placed.variant,
        body: wheelBody(body),
        radius,
        home: { x: centerX + side * spread, y: box.y + box.h - radius },
      });
    karts.push({
      id: `kart-${karts.length}`,
      variant: placed.variant,
      body,
      length: box.w,
      height: box.h,
      wheels: [wheelAt(-1), wheelAt(1)],
      spring: { x: 0, y: 0 },
      springVelocity: { x: 0, y: 0 },
      axleVelocity: { x: 0, y: 0 },
      facing: 1,
      driverId: null,
      state: { kind: "none" },
      stepStartVelocity: { x: 0, y: 0 },
    });
  }
  return { karts, downHeld: new Map(), jumpHeld: new Map(), hitCooldowns: new Map() };
}

/** Karts with both wheels in play. */
export const kartsInPlay = (state: KartsState): Kart[] => state.karts.filter(kartInPlay);

/**
 * A seated driver's own input: the kart takes its stick, jump and down (it drives, hops and gets
 * out with them); aim and fire stay, so it fires its weapon from the seat (owner Q2).
 */
export function seatedInputs(
  state: KartsState,
  players: readonly PlayerState[],
  inputs: PlayerInputs
): PlayerInputs {
  const seated = new Set(state.karts.flatMap((kart) => kart.driverId ?? []));
  if (seated.size === 0) return inputs;
  return inputs.map((input, slot): PlayerInput => {
    const player = players.find((candidate) => candidate.slot === slot);
    if (!input || !player || !seated.has(player.id)) return input;
    return { ...input, moveX: 0, jump: false, crouch: false };
  });
}

export interface DriveStep {
  players: readonly PlayerState[];
  inputs: PlayerInputs;
  physics: PhysicsObjectsState;
  now: number;
  dt: number;
}

/**
 * Before the physics objects move: each driver's stick and jump work on its kart, and every kart
 * notes its speed (hits read it before this step's bumps take any off).
 */
export function driveKarts(state: KartsState, step: DriveStep): void {
  for (const kart of kartsInPlay(state)) {
    kart.stepStartVelocity = axleOf(kart).velocity;
    const driver = step.players.find((player) => player.id === kart.driverId);
    if (!driver) continue;
    const input = step.inputs[driver.slot];
    const jump = input?.jump === true;
    const pressed = jump && state.jumpHeld.get(driver.id) !== true;
    state.jumpHeld.set(driver.id, jump);
    const hopped = driveKart(kart, { moveX: input?.moveX ?? 0, hop: pressed }, step.dt);
    if (!hopped) continue;
    addMoment(
      step.physics,
      { id: kart.id, ...chassisOf(kart).center },
      {
        kind: "hop",
        soundId: "jump",
        atSeconds: step.now,
      }
    );
  }
}

export interface StepKartsArgs {
  physics: PhysicsObjectsState;
  terrain: TerrainGrid;
  /** Players in play (drivers included). */
  players: readonly PlayerState[];
  now: number;
  dt: number;
  tunables: GameTunables;
}

/**
 * Whole-object state (owner rule): a kart burns or freezes as a whole. When one wheel's fire or
 * frost changed, the other takes the same; a burning kart puts its driver out.
 */
function keepStateWhole(kart: Kart, args: StepKartsArgs): void {
  const changed = kart.wheels.find((wheel) => wheel.state !== kart.state);
  if (!changed) return;
  kart.state = changed.state;
  for (const wheel of kart.wheels) {
    wheel.state = changed.state;
    wheel.chill = changed.chill;
  }
  if (kart.state.kind === "burning") ejectDriver(kart, { ...args });
}

/** One wheel popped (stuck, burnt through, out of the arena): the driver out first, then the whole kart. */
function popWhole(kart: Kart, args: StepKartsArgs): void {
  ejectDriver(kart, args);
  for (const wheel of kart.wheels) {
    popObject(args.physics, wheel, { now: args.now, tunables: args.tunables, soundId: "none" });
  }
  kart.spring = { x: 0, y: 0 };
  kart.springVelocity = { x: 0, y: 0 };
  kart.axleVelocity = { x: 0, y: 0 };
  kart.state = { kind: "none" };
}

/**
 * After the physics objects moved (match step 3h): keep each kart whole (state, pops), hold its
 * wheels together, spring the chassis, then blobs against karts. Returns this step's kart hits
 * for combat; seated drivers end the step on their seats.
 */
export function stepKarts(state: KartsState, args: StepKartsArgs): KartHit[] {
  for (const kart of state.karts) {
    // A wheel popped this step (or earlier): the rest of the kart goes too, its driver out first.
    if (!kartInPlay(kart)) {
      popWhole(kart, args);
      continue;
    }
    keepStateWhole(kart, args);
    holdWheels(kart, args.terrain);
    stepSpring(kart, args);
  }
  const inPlay = kartsInPlay(state);
  const seated = new Set(state.karts.flatMap((kart) => kart.driverId ?? []));
  const hits = bumpKartsAndBlobs(state, {
    ...args,
    inPlay,
    players: args.players.filter((player) => !seated.has(player.id)),
    slotOf: (id) => args.players.find((player) => player.id === id)?.slot ?? null,
  });
  seatDrivers(state, args.players);
  return hits;
}

/** Circles of the chassis of karts in play (rockets explode on them; the wheels are round bodies already). */
export function kartRoundBodies(
  state: KartsState
): { center: { x: number; y: number }; radius: number }[] {
  return kartsInPlay(state).flatMap((kart) => {
    const chassis = chassisOf(kart);
    return [-1, 0, 1].map((k) => ({
      center: {
        x: chassis.center.x + chassis.along.x * chassis.halfLength * k,
        y: chassis.center.y + chassis.along.y * chassis.halfLength * k,
      },
      radius: chassis.radius,
    }));
  });
}

/** One engine per driven kart: who drives (pitch) and how fast (0–1 of `karts.humFullSpeed`). */
export function kartEngines(
  state: KartsState,
  ctx: { players: readonly PlayerState[]; tunables: GameTunables }
): { key: string; slot: number; speed: number }[] {
  return kartsInPlay(state).flatMap((kart) => {
    const driver = ctx.players.find((player) => player.id === kart.driverId);
    if (!driver || kart.state.kind === "burning") return [];
    const { velocity } = axleOf(kart);
    const speed = Math.min(1, Math.hypot(velocity.x, velocity.y) / ctx.tunables.karts.humFullSpeed);
    return [{ key: kart.id, slot: driver.slot, speed }];
  });
}
