import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import type { LevelCollectible } from "@/features/level/api/levelApi";
import { createPlayer, type PlayerState } from "@/features/player/api/playerApi";
import {
  DIVE_REFILL_ITEM,
  createDiveRefills,
  stepDiveRefills,
} from "@/features/collectibles/services/diveRefills";
import type {
  DiveRefillPickup,
  PickupBurst,
} from "@/features/collectibles/types/collectibles.types";

const tunables = DEFAULT_GAME_TUNABLES;
const { respawnSeconds } = tunables.collectibles.diveRefill;
const dt = 1 / 120;
const points: LevelCollectible[] = [
  { at: { x: 100, y: 200 }, itemId: "point-orb" },
  { at: { x: 300, y: 200 }, itemId: DIVE_REFILL_ITEM },
  { at: { x: 500, y: 200 }, itemId: DIVE_REFILL_ITEM },
];

/** A player whose body overlaps the point at `x` (feet a little below the point). */
const playerAt = (slot: number, x: number): PlayerState =>
  createPlayer(slot, { x, y: 210 }, tunables);

function run(refills: DiveRefillPickup[], seconds: number, players: PlayerState[] = []) {
  const collected = [];
  for (let t = 0; t < seconds - 1e-9; t += dt) {
    collected.push(...stepDiveRefills({ refills, players, tunables, dt, bursts: [] }));
  }
  return collected;
}

describe("diveRefills", () => {
  it("should place one present pickup on each dive-reset point when the match starts", () => {
    const refills = createDiveRefills(points);
    expect(refills.map((refill) => [refill.pointIndex, refill.x, refill.y])).toEqual([
      [1, 300, 200],
      [2, 500, 200],
    ]);
    expect(refills.every((refill) => refill.respawnTimer === 0)).toBe(true);
  });

  it("should give the pickup to the player touching it and take it away when it is collected", () => {
    const refills = createDiveRefills(points);
    const bursts: PickupBurst[] = [];
    const players = [playerAt(3, 300)];
    const collected = stepDiveRefills({ refills, players, tunables, dt, bursts });
    expect(collected).toEqual([{ slot: 3, x: 300, y: 200 }]);
    expect(bursts).toEqual([{ id: 1, itemId: "dive-reset", x: 300, y: 200, ageSeconds: 0 }]);
    expect(refills[0]!.respawnTimer).toBeCloseTo(respawnSeconds);
    expect(refills[1]!.respawnTimer).toBe(0);
  });

  it("should not be taken again when a player touches it while it is gone", () => {
    const refills = createDiveRefills(points);
    run(refills, dt, [playerAt(0, 300)]);
    const again = run(refills, respawnSeconds - 0.1, [playerAt(1, 300)]);
    expect(again).toEqual([]);
  });

  it("should come back on its point when the respawn time has passed", () => {
    const refills = createDiveRefills(points);
    run(refills, dt, [playerAt(0, 300)]);
    run(refills, respawnSeconds);
    expect(refills[0]!.respawnTimer).toBe(0);
    expect(run(refills, dt, [playerAt(1, 300)])).toEqual([{ slot: 1, x: 300, y: 200 }]);
  });

  it("should let a player take only one pickup when two overlap in the same step", () => {
    const refills = createDiveRefills([
      { at: { x: 300, y: 200 }, itemId: DIVE_REFILL_ITEM },
      { at: { x: 304, y: 200 }, itemId: DIVE_REFILL_ITEM },
    ]);
    expect(run(refills, dt, [playerAt(0, 300)])).toHaveLength(1);
    expect(refills[1]!.respawnTimer).toBe(0);
  });
});
