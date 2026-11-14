import { describe, expect, it } from "vitest";
import { chooseSpawnIndex } from "@/features/match/services/spawnChoice";

const spawns = [
  { x: 0, y: 0 },
  { x: 500, y: 0 },
  { x: 1000, y: 0 },
];

describe("chooseSpawnIndex", () => {
  it("should pick the spawn farthest from the only opponent when one opponent is in play", () => {
    expect(chooseSpawnIndex({ spawns, opponents: [{ x: 50, y: 0 }], slot: 0 })).toBe(2);
    expect(chooseSpawnIndex({ spawns, opponents: [{ x: 900, y: 0 }], slot: 0 })).toBe(0);
  });

  it("should maximise the distance to the nearest opponent when several are in play", () => {
    // Opponents at both ends: the middle spawn is 500 from each; the ends are 0 from one.
    const opponents = [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
    ];
    expect(chooseSpawnIndex({ spawns, opponents, slot: 0 })).toBe(1);
  });

  it("should pick the lowest index when spawns tie", () => {
    expect(chooseSpawnIndex({ spawns, opponents: [{ x: 500, y: 0 }], slot: 1 })).toBe(0);
  });

  it("should use the slot's own spawn when no opponent is in play", () => {
    expect(chooseSpawnIndex({ spawns, opponents: [], slot: 1 })).toBe(1);
    expect(chooseSpawnIndex({ spawns, opponents: [], slot: 4 })).toBe(1);
  });

  it("should return -1 when the level has no spawns", () => {
    expect(chooseSpawnIndex({ spawns: [], opponents: [], slot: 0 })).toBe(-1);
  });
});
