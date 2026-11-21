import type { Vec2 } from "@/shared/types/gameGeometry.types";
import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { PlayerInputs } from "@/shared/types/gameInput.types";
import type { TerrainGrid } from "@/features/arena/api/arenaApi";
import { escapeSolid, placePlayer, type PlayerState } from "@/features/player/api/playerApi";
import {
  addMoment,
  type PhysicsObjectsState,
} from "@/features/physics-objects/api/physicsObjectsApi";
import {
  axleOf,
  chassisOf,
  kickSpring,
  nearestOnChassis,
  wheelRadiusOf,
} from "@/features/karts/services/kartBody";
import type { Kart, KartsState } from "@/features/karts/services/kartModel";

/**
 * Getting in and out of a kart (owner Q2; kart K4–K6). A **fresh press of down** (the crouch
 * input's press edge) while the blob touches an empty kart gets in; the next fresh press gets
 * out. Boarding happens on the press itself, so the blob never starts a crouch or crouch roll
 * (those need down held on the ground). A seated driver is placed on the seat every step, its
 * lower half inside the open tub. Getting out puts the blob beside the kart through the player's
 * `escapeSolid` (the shared `freeSpotSearch`), so it is never left inside a wall. Pure TS.
 */

/** A blob within this much of the kart's outline touches it (world units). */
const TOUCH_MARGIN = 4;
/** The seat sits this far toward the back from the chassis middle, × kart length. */
const SEAT_BACK = 0.12;
/** Spring kicks (units / s): getting in sinks the chassis, getting out lets it spring up. */
const BOARD_KICK = 140;
const LEAVE_KICK = 90;

const blobCenter = (player: PlayerState): Vec2 => ({
  x: player.x,
  y: player.y - player.height / 2,
});

/** The kart is in play: neither wheel popped and waiting to come back. */
export const kartInPlay = (kart: Kart): boolean =>
  kart.wheels.every((wheel) => wheel.goneUntil === null);

/** The blob touches the kart's chassis or a wheel (within `TOUCH_MARGIN`). */
export function touchesKart(kart: Kart, player: PlayerState): boolean {
  const center = blobCenter(player);
  const reach = player.width / 2 + TOUCH_MARGIN;
  const chassis = chassisOf(kart);
  const near = nearestOnChassis(chassis, center);
  if (Math.hypot(center.x - near.x, center.y - near.y) <= chassis.radius + reach) return true;
  const r = wheelRadiusOf(kart);
  return kart.wheels.some(
    (wheel) => Math.hypot(center.x - wheel.x, center.y - wheel.y) <= r + reach
  );
}

/** The driver's feet on the seat: low in the tub (its lower half hides behind the body). */
export function seatOf(kart: Kart): Vec2 {
  const chassis = chassisOf(kart);
  const back = -kart.facing * SEAT_BACK * kart.length;
  return {
    x: chassis.center.x + chassis.along.x * back - chassis.up.x * chassis.radius,
    y: chassis.center.y + chassis.along.y * back - chassis.up.y * chassis.radius,
  };
}

/** Puts a driver on its seat, moving with the kart; it stands on the seat (no fall, no landing). */
export function seatDriver(kart: Kart, driver: PlayerState): void {
  const seat = seatOf(kart);
  const { velocity } = axleOf(kart);
  driver.x = seat.x;
  driver.y = seat.y;
  driver.vx = velocity.x;
  driver.vy = velocity.y;
  driver.grounded = true;
  driver.airSeconds = 0;
  driver.crouching = false;
  driver.crouchRollSeconds = 0;
}

export interface SeatStep {
  physics: PhysicsObjectsState;
  terrain: TerrainGrid;
  tunables: GameTunables;
  now: number;
}

function board(kart: Kart, player: PlayerState, step: SeatStep): void {
  placePlayer(player, seatOf(kart));
  kart.driverId = player.id;
  kart.facing = player.facing;
  seatDriver(kart, player);
  const chassis = chassisOf(kart);
  kickSpring(kart, { x: -chassis.up.x * BOARD_KICK, y: -chassis.up.y * BOARD_KICK });
  addMoment(
    step.physics,
    { id: kart.id, ...chassis.center },
    {
      kind: "board",
      soundId: "land",
      atSeconds: step.now,
    }
  );
}

/** Candidate feet spots for a blob getting out: behind the kart, in front, then on top. */
function exitSpots(kart: Kart, player: PlayerState): Vec2[] {
  const chassis = chassisOf(kart);
  const sideReach = kart.length / 2 + player.width / 2 + 2;
  const feetY = chassis.center.y + chassis.radius + wheelRadiusOf(kart) * 2;
  const side = (s: number): Vec2 => ({ x: chassis.center.x + s * sideReach, y: feetY });
  const top = { x: chassis.center.x, y: chassis.center.y - chassis.radius - 1 };
  return [side(-kart.facing), side(kart.facing), top];
}

/**
 * Puts the driver out beside the kart (never inside a wall: each spot goes through
 * `escapeSolid`, the shared never-stuck search), with the kart's speed and a small hop up.
 */
export function leaveKart(kart: Kart, player: PlayerState, step: SeatStep): void {
  const { velocity } = axleOf(kart);
  kart.driverId = null;
  const minScale = step.tunables.player.crushGapFraction;
  for (const spot of exitSpots(kart, player)) {
    placePlayer(player, spot);
    if (escapeSolid(player, step.terrain, { minScale: 1 }) !== "trapped") break;
    escapeSolid(player, step.terrain, { minScale });
  }
  player.vx = velocity.x;
  player.vy = Math.min(velocity.y, 0) - step.tunables.karts.exitHopSpeed;
  const chassis = chassisOf(kart);
  kickSpring(kart, { x: chassis.up.x * LEAVE_KICK, y: chassis.up.y * LEAVE_KICK });
  addMoment(
    step.physics,
    { id: kart.id, ...chassis.center },
    {
      kind: "leave",
      soundId: "jump",
      atSeconds: step.now,
    }
  );
}

const driverOf = (kart: Kart, players: readonly PlayerState[]): PlayerState | undefined =>
  kart.driverId === null ? undefined : players.find((player) => player.id === kart.driverId);

/** A kart a blob may get into: empty, in play and not on fire. */
const boardable = (kart: Kart): boolean =>
  kart.driverId === null && kartInPlay(kart) && kart.state.kind !== "burning";

/**
 * Fresh presses of down get blobs in and out; a driver no longer in play (knocked out) leaves
 * its seat empty. Run before the players move, with this step's inputs.
 */
export function stepSeats(
  karts: KartsState,
  step: SeatStep & { players: readonly PlayerState[]; inputs: PlayerInputs }
): void {
  for (const kart of karts.karts) {
    if (kart.driverId !== null && !driverOf(kart, step.players)) kart.driverId = null;
  }
  for (const player of step.players) {
    const down = step.inputs[player.slot]?.crouch === true;
    const pressed = down && karts.downHeld.get(player.id) !== true;
    karts.downHeld.set(player.id, down);
    if (!pressed) continue;
    const seated = karts.karts.find((kart) => kart.driverId === player.id);
    if (seated) {
      leaveKart(seated, player, step);
      continue;
    }
    const kart = karts.karts.find(
      (candidate) => boardable(candidate) && touchesKart(candidate, player)
    );
    if (kart) board(kart, player, step);
  }
}

/** Puts every driver out of its kart (burning, about to pop) before anything else happens to it. */
export function ejectDriver(
  kart: Kart,
  step: SeatStep & { players: readonly PlayerState[] }
): void {
  const driver = driverOf(kart, step.players);
  if (driver) leaveKart(kart, driver, step);
  kart.driverId = null;
}

/** Places every seated driver on its seat (after the players' step and after the karts'). */
export function seatDrivers(karts: KartsState, players: readonly PlayerState[]): void {
  for (const kart of karts.karts) {
    const driver = driverOf(kart, players);
    if (driver) seatDriver(kart, driver);
  }
}

/** Ids of the blobs seated in a kart now. */
export const driverIds = (karts: KartsState): Set<string> =>
  new Set(karts.karts.flatMap((kart) => (kart.driverId === null ? [] : [kart.driverId])));
