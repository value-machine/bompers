import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import { createArenaState } from "@/features/arena/api/arenaApi";
import { normalizeLevelDefinition, type LevelDefinition } from "@/features/level/api/levelApi";
import { createPlayer } from "@/features/player/services/playerController";
import { escapeSolid } from "@/features/player/services/solidEscape";

// Ground truth: the never-stuck invariant (owner) — nearest free spot, else shrink to fit down to
// the crush size, else trapped.
const terrainWith = (rects: { x: number; y: number; w: number; h: number }[]) => {
  const level: LevelDefinition = {
    formatVersion: 2,
    meta: { levelId: "t", title: "T" },
    settings: { cellSize: 4, gravity: 1 },
    worldSize: { w: 400, h: 300 },
    terrain: rects.map((shape) => ({ shape: { type: "rect", ...shape }, materialId: "stone" })),
    spawns: [{ x: 40, y: 200 }],
    drops: [],
    collectibles: [],
    bounds: { x: 0, y: 0, w: 400, h: 300 },
  };
  return createArenaState(normalizeLevelDefinition(level).level).terrain;
};
const FLOOR = { x: 0, y: 200, w: 400, h: 40 };
const limits = { minScale: DEFAULT_GAME_TUNABLES.player.crushGapFraction };

describe("escapeSolid", () => {
  it("should leave a free body where it is when it touches nothing", () => {
    const player = createPlayer(0, { x: 100, y: 200 }, DEFAULT_GAME_TUNABLES);
    expect(escapeSolid(player, terrainWith([FLOOR]), limits)).toBe("free");
    expect(player.x).toBe(100);
  });

  it("should lift a body sunk into the floor back up to contact when it overlaps", () => {
    const terrain = terrainWith([FLOOR]);
    const player = createPlayer(0, { x: 100, y: 206 }, DEFAULT_GAME_TUNABLES);
    expect(escapeSolid(player, terrain, limits)).toBe("moved");
    expect(player.x).toBeCloseTo(100, 1);
    expect(player.y).toBeGreaterThan(199);
    expect(player.y).toBeLessThanOrEqual(200.01);
    expect(escapeSolid(player, terrain, limits)).toBe("free");
  });

  it("should squeeze a body into a shaft narrower than it when it fits nowhere at full size", () => {
    // A 20-wide shaft (20 / 28 ≈ 0.71 of the body) between two walls, closed above.
    const terrain = terrainWith([
      FLOOR,
      { x: 40, y: 80, w: 50, h: 120 },
      { x: 110, y: 80, w: 50, h: 120 },
      { x: 40, y: 60, w: 120, h: 20 },
    ]);
    const player = createPlayer(0, { x: 100, y: 200 }, DEFAULT_GAME_TUNABLES);
    expect(escapeSolid(player, terrain, limits)).toBe("squeezed");
    expect(player.squeeze?.scale).toBeLessThan(0.75);
    expect(player.squeeze?.scale).toBeGreaterThan(limits.minScale);
  });

  it("should report a body trapped when even the crush size fits nowhere within a body width", () => {
    const player = createPlayer(0, { x: 100, y: 150 }, DEFAULT_GAME_TUNABLES);
    const terrain = terrainWith([{ x: 0, y: 40, w: 300, h: 200 }]);
    expect(escapeSolid(player, terrain, limits)).toBe("trapped");
    expect(player.x).toBe(100);
    expect(player.y).toBe(150);
  });
});
