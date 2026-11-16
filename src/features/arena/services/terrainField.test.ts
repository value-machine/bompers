import { describe, expect, it } from "vitest";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import { buildTerrainFromLevel } from "@/features/arena/services/terrainRaster";
import { clearCrater } from "@/features/arena/services/terrainGrid";
import {
  fieldDistanceAt,
  circleHitsSolid,
  fieldNormalAt,
  settleCircle,
} from "@/features/arena/services/terrainField";

const TOP = 200;
const level: LevelDefinition = {
  formatVersion: 2,
  meta: { levelId: "f", title: "F" },
  settings: { cellSize: 4, gravity: 1 },
  worldSize: { w: 600, h: 400 },
  terrain: [{ shape: { type: "rect", x: 0, y: TOP, w: 600, h: 200 }, materialId: "earth" }],
  spawns: [],
  drops: [],
  collectibles: [],
  bounds: { x: 0, y: 0, w: 600, h: 400 },
};

const crater = { x: 300, y: TOP, reach: 34, shape: "round" as const };
const cratered = () => {
  const grid = buildTerrainFromLevel(level);
  clearCrater(grid, crater);
  return grid;
};

describe("terrainField", () => {
  it("should read the distance to a flat top within half a unit out to a body radius", () => {
    const grid = buildTerrainFromLevel(level);
    for (const above of [0, 3.5, 7, 14]) {
      expect(fieldDistanceAt(grid, { x: 150, y: TOP - above })).toBeCloseTo(-above, 0);
    }
  });

  it("should read the distance to a crater wall within one unit out to a body radius", () => {
    const grid = cratered();
    for (let deg = 20; deg <= 160; deg += 20) {
      const a = (deg * Math.PI) / 180;
      for (const inset of [2, 8, 14]) {
        const r = crater.reach - inset;
        const p = { x: crater.x + Math.cos(a) * r, y: crater.y + Math.sin(a) * r };
        expect(Math.abs(fieldDistanceAt(grid, p) + inset), `${deg}° inset ${inset}`).toBeLessThan(
          1
        );
      }
    }
  });

  it("should point the normal toward the crater centre when read near its wall", () => {
    const grid = cratered();
    for (let deg = 20; deg <= 160; deg += 20) {
      const a = (deg * Math.PI) / 180;
      const p = { x: crater.x + Math.cos(a) * 24, y: crater.y + Math.sin(a) * 24 };
      const n = fieldNormalAt(grid, p);
      const angle = Math.acos(-(n.x * Math.cos(a) + n.y * Math.sin(a)));
      expect(angle, `${deg}°`).toBeLessThan((5 * Math.PI) / 180);
    }
  });

  it("should point the normal straight up when read above flat ground", () => {
    const n = fieldNormalAt(buildTerrainFromLevel(level), { x: 150, y: TOP - 10 });
    expect(n.x).toBeCloseTo(0, 3);
    expect(n.y).toBeCloseTo(-1, 3);
  });

  it("should report a circle as touching when it is closer to the surface than its radius", () => {
    const grid = buildTerrainFromLevel(level);
    expect(circleHitsSolid(grid, { center: { x: 150, y: TOP - 13.5 }, radius: 14 })).toBe(true);
    expect(circleHitsSolid(grid, { center: { x: 150, y: TOP - 14.5 }, radius: 14 })).toBe(false);
  });

  it("should rest a circle on the ground when settled from above or from inside it", () => {
    const grid = buildTerrainFromLevel(level);
    const reach = { rise: 8, drop: 8 };
    for (const startY of [TOP - 19, TOP - 9]) {
      const settled = settleCircle(grid, { center: { x: 150, y: startY }, radius: 14 }, reach);
      expect(settled.kind).toBe("ground");
      if (settled.kind === "ground") expect(settled.centerY).toBeCloseTo(TOP - 14, 2);
    }
  });

  it("should report air or blocked when the ground is out of reach of a settle", () => {
    const grid = buildTerrainFromLevel(level);
    const reach = { rise: 4, drop: 4 };
    const settle = (y: number) => settleCircle(grid, { center: { x: 150, y }, radius: 14 }, reach);
    expect(settle(TOP - 30).kind).toBe("air");
    expect(settle(TOP - 2).kind).toBe("blocked");
  });
});
