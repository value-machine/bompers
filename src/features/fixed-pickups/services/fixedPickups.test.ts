import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import type { LevelCollectible } from "@/features/level/api/levelApi";
import { createPlayer, type PlayerState } from "@/features/player/api/playerApi";
import {
  DIVE_REFILL_ITEM,
  HEALTH_PICKUP_ITEM,
  createFixedPickups,
  stepFixedPickups,
} from "@/features/fixed-pickups/services/fixedPickups";
import type {
  FixedPickup,
  FixedPickupItem,
} from "@/features/fixed-pickups/types/fixedPickups.types";

const tunables = DEFAULT_GAME_TUNABLES;
const { respawnSeconds } = tunables.collectibles.diveRefill;
const dt = 1 / 120;
const points: LevelCollectible[] = [
  { at: { x: 100, y: 200 }, itemId: "point-orb" },
  { at: { x: 300, y: 200 }, itemId: DIVE_REFILL_ITEM },
  { at: { x: 500, y: 200 }, itemId: DIVE_REFILL_ITEM },
  { at: { x: 700, y: 200 }, itemId: HEALTH_PICKUP_ITEM },
];

/** A player whose body overlaps the point at `x` (feet a little below the point). */
const playerAt = (slot: number, x: number): PlayerState =>
  createPlayer(slot, { x, y: 210 }, tunables);

const anyone = (): boolean => true;

function run(
  pickups: FixedPickup[],
  seconds: number,
  who: {
    players?: PlayerState[];
    canTake?: (itemId: FixedPickupItem, player: PlayerState) => boolean;
  } = {}
) {
  const { players = [], canTake = anyone } = who;
  const taken = [];
  for (let t = 0; t < seconds - 1e-9; t += dt) {
    taken.push(...stepFixedPickups({ pickups, players, canTake, tunables, dt }));
  }
  return taken.map(({ itemId, slot, x }) => ({ itemId, slot, x }));
}

describe("fixedPickups", () => {
  it("should place one present pickup on each fixed pickup point when the match starts", () => {
    const pickups = createFixedPickups(points);
    expect(pickups.map((p) => [p.itemId, p.pointIndex, p.x])).toEqual([
      [DIVE_REFILL_ITEM, 1, 300],
      [DIVE_REFILL_ITEM, 2, 500],
      [HEALTH_PICKUP_ITEM, 3, 700],
    ]);
    expect(pickups.every((p) => p.respawnTimer === 0)).toBe(true);
  });

  it("should give the pickup to the player touching it and take it away when it is collected", () => {
    const pickups = createFixedPickups(points);
    expect(run(pickups, dt, { players: [playerAt(3, 300)] })).toEqual([
      { itemId: DIVE_REFILL_ITEM, slot: 3, x: 300 },
    ]);
    expect(pickups[0]!.respawnTimer).toBeCloseTo(respawnSeconds);
    expect(pickups[1]!.respawnTimer).toBe(0);
  });

  it("should not be taken again when a player touches it while it is gone", () => {
    const pickups = createFixedPickups(points);
    run(pickups, dt, { players: [playerAt(0, 300)] });
    expect(run(pickups, respawnSeconds - 0.1, { players: [playerAt(1, 300)] })).toEqual([]);
  });

  it("should come back on its point when the respawn time has passed", () => {
    const pickups = createFixedPickups(points);
    run(pickups, dt, { players: [playerAt(0, 300)] });
    run(pickups, respawnSeconds);
    expect(pickups[0]!.respawnTimer).toBe(0);
    expect(run(pickups, dt, { players: [playerAt(1, 300)] })).toEqual([
      { itemId: DIVE_REFILL_ITEM, slot: 1, x: 300 },
    ]);
  });

  it("should let a player take only one pickup of an item when two overlap in the same step", () => {
    const pickups = createFixedPickups([
      { at: { x: 300, y: 200 }, itemId: DIVE_REFILL_ITEM },
      { at: { x: 304, y: 200 }, itemId: DIVE_REFILL_ITEM },
    ]);
    expect(run(pickups, dt, { players: [playerAt(0, 300)] })).toHaveLength(1);
    expect(pickups[1]!.respawnTimer).toBe(0);
  });

  it("should stay on its point when the touching player may not take it", () => {
    const pickups = createFixedPickups(points);
    const fullHealth = (itemId: FixedPickupItem) => itemId !== HEALTH_PICKUP_ITEM;
    expect(run(pickups, dt, { players: [playerAt(0, 700)], canTake: fullHealth })).toEqual([]);
    expect(pickups[2]!.respawnTimer).toBe(0);
  });

  it("should be gone for the health respawn time when a health pickup is taken", () => {
    const pickups = createFixedPickups(points);
    expect(run(pickups, dt, { players: [playerAt(2, 700)] })).toEqual([
      { itemId: HEALTH_PICKUP_ITEM, slot: 2, x: 700 },
    ]);
    expect(pickups[2]!.respawnTimer).toBeCloseTo(tunables.collectibles.health.respawnSeconds);
  });
});
