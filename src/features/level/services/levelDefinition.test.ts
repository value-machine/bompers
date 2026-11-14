import { describe, expect, it } from "vitest";
import type { LevelDefinition } from "@/features/level/types/levelDefinition.types";
import { normalizeLevelDefinition } from "@/features/level/services/levelDefinition";
import { PLACEHOLDER_LEVEL } from "@/features/level/services/placeholderLevel";

const base: LevelDefinition = {
  formatVersion: 1,
  meta: { levelId: "t", title: "T" },
  settings: { cellSize: 8, gravity: 1 },
  worldSize: { w: 100, h: 100 },
  terrain: [],
  spawns: [
    { x: 1, y: 1 },
    { x: 2, y: 2 },
  ],
  drops: [],
  collectibles: [],
  bounds: { x: 0, y: 0, w: 100, h: 100 },
};

describe("levelDefinition", () => {
  it("should report no warnings when the placeholder level is normalized", () => {
    expect(normalizeLevelDefinition(PLACEHOLDER_LEVEL).warnings).toEqual([]);
  });

  it("should replace an unknown material with the role default and warn", () => {
    const { level, warnings } = normalizeLevelDefinition({
      ...base,
      terrain: [
        {
          shape: { type: "rect", x: 0, y: 0, w: 8, h: 8 },
          role: "destructible",
          materialId: "jelly",
        },
      ],
    });
    expect(level.terrain[0]?.materialId).toBe("dirt");
    expect(warnings).toEqual(['terrain[0]: unknown material "jelly", using "dirt"']);
  });

  it("should drop unknown behavior and item references and warn for each", () => {
    const { level, warnings } = normalizeLevelDefinition({
      ...base,
      terrain: [
        {
          shape: { type: "circle", cx: 4, cy: 4, r: 4 },
          role: "platform",
          materialId: "stone",
          behaviorId: "spin",
        },
      ],
      drops: [{ at: { x: 0, y: 0 }, itemIds: ["rocket-launcher", "laser"] }],
      collectibles: [{ at: { x: 0, y: 0 }, itemId: "gem" }],
    });
    expect(level.terrain[0]).not.toHaveProperty("behaviorId");
    expect(level.drops[0]?.itemIds).toEqual(["rocket-launcher"]);
    expect(level.collectibles).toEqual([]);
    expect(warnings).toHaveLength(3);
  });

  it("should fill missing settings with defaults", () => {
    const partial = { ...base, settings: { gravity: 2 } as LevelDefinition["settings"] };
    expect(normalizeLevelDefinition(partial).level.settings).toEqual({ cellSize: 8, gravity: 2 });
  });

  it("should warn when fewer than two spawns are given", () => {
    const { warnings } = normalizeLevelDefinition({ ...base, spawns: [{ x: 0, y: 0 }] });
    expect(warnings[0]).toMatch(/at least 2/);
  });
});
