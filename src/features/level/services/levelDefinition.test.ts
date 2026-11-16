import { describe, expect, it } from "vitest";
import type { LevelDefinition } from "@/features/level/types/levelDefinition.types";
import { normalizeLevelDefinition } from "@/features/level/services/levelDefinition";

const base: LevelDefinition = {
  formatVersion: 1,
  meta: { levelId: "t", title: "T" },
  settings: { cellSize: 8, gravity: 1 },
  worldSize: { w: 100, h: 100 },
  terrain: [],
  spawns: [
    { x: 10, y: 10 },
    { x: 20, y: 20 },
  ],
  drops: [],
  collectibles: [],
  bounds: { x: 0, y: 0, w: 100, h: 100 },
};

const rect = { type: "rect" as const, x: 0, y: 0, w: 8, h: 8 };

describe("levelDefinition", () => {
  it("should replace an unknown material with the default material and warn", () => {
    const { level, warnings } = normalizeLevelDefinition({
      ...base,
      terrain: [{ shape: rect, materialId: "jelly" }],
    });
    expect(level.terrain[0]).toMatchObject({ materialId: "stone", colorId: "plum" });
    expect(warnings).toEqual(['terrain[0]: unknown material "jelly", using "stone"']);
  });

  it("should fill the material's colour when a piece names none or an unknown one", () => {
    const { level, warnings } = normalizeLevelDefinition({
      ...base,
      terrain: [
        { shape: rect, materialId: "ice" },
        { shape: rect, materialId: "cardboard", colorId: "teal" },
        { shape: rect, materialId: "earth", colorId: "mint" },
      ],
    });
    expect(level.terrain.map((p) => p.colorId)).toEqual(["frost", "cardboard", "mint"]);
    expect(warnings).toEqual(['terrain[1]: unknown color "teal", using "cardboard"']);
  });

  it("should drop unknown effect, sound and behavior references so the material default applies", () => {
    const { level, warnings } = normalizeLevelDefinition({
      ...base,
      terrain: [
        {
          shape: rect,

          materialId: "stone",
          effectId: "boom",
          soundId: "dust-burst",
          behaviorId: "spin",
        },
      ],
    });
    expect(level.terrain[0]).toEqual({ shape: rect, materialId: "stone", colorId: "plum" });
    expect(warnings).toHaveLength(3);
  });

  it("should replace unknown items with the catalog defaults for drops and collectibles", () => {
    const { level } = normalizeLevelDefinition({
      ...base,
      drops: [
        { at: { x: 1, y: 1 }, itemIds: ["laser"] },
        { at: { x: 2, y: 2 }, itemIds: ["rocket-launcher", "laser"] },
      ],
      collectibles: [{ at: { x: 3, y: 3 }, itemId: "gem" }],
    });
    expect(level.drops.map((d) => d.itemIds)).toEqual([["rocket-launcher"], ["rocket-launcher"]]);
    expect(level.collectibles[0]?.itemId).toBe("point-orb");
  });

  it("should ignore points outside the bounds and warn", () => {
    const { level, warnings } = normalizeLevelDefinition({
      ...base,
      spawns: [...base.spawns, { x: 500, y: 10 }],
      drops: [{ at: { x: -5, y: 0 }, itemIds: ["rocket-launcher"] }],
    });
    expect(level.spawns).toHaveLength(2);
    expect(level.drops).toEqual([]);
    expect(warnings).toEqual([
      "spawns[2]: outside bounds, ignored",
      "drops[0]: outside bounds, ignored",
    ]);
  });

  it("should fall back to default settings when values are out of range", () => {
    const { level, warnings } = normalizeLevelDefinition({
      ...base,
      settings: { cellSize: 0, gravity: -1, matchDurationS: 2.5 },
    });
    expect(level.settings).toEqual({ cellSize: 8, gravity: 1 });
    expect(warnings).toHaveLength(3);
  });

  it("should warn when fewer than two valid spawns remain", () => {
    const { warnings } = normalizeLevelDefinition({ ...base, spawns: [{ x: 0, y: 0 }] });
    expect(warnings).toEqual(["spawns: 1 valid, at least 2 expected"]);
  });
});
