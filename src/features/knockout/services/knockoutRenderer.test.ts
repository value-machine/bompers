import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import { buildTerrainFromLevel, clearCrater } from "@/features/arena/api/arenaApi";
import {
  createKnockoutView,
  syncKnockoutView,
  type KnockoutFrame,
} from "@/features/knockout/services/knockoutRenderer";
import { createKnockoutWorld } from "@/features/knockout/services/knockoutSim";
import { STAIN_LOOK } from "@/features/knockout/services/stainShape";
import type { GooSplat } from "@/features/knockout/types/knockout.types";

// A breakable floor (top at y 100) and one sliding bar above it (top at y 40).
const level: LevelDefinition = {
  formatVersion: 2,
  meta: { levelId: "m", title: "M" },
  settings: { cellSize: 4, gravity: 1 },
  worldSize: { w: 400, h: 200 },
  terrain: [
    { shape: { type: "rect", x: 48, y: 100, w: 304, h: 80 }, materialId: "earth" },
    { shape: { type: "rect", x: 100, y: 40, w: 80, h: 16 }, materialId: "stone" },
  ],
  movers: [
    {
      motion: { kind: "slide", offset: { x: 60, y: 0 }, periodS: 4, phase: 0 },
      pivot: { x: 140, y: 48 },
      terrainIndices: [1],
    },
  ],
  spawns: [],
  drops: [],
  collectibles: [],
  bounds: { x: -100, y: -100, w: 600, h: 400 },
};

const splat = (over: Partial<GooSplat>): GooSplat => ({
  key: "7:d0",
  slot: 1,
  x: 200,
  y: 100,
  nx: 0,
  ny: -1,
  radius: 5,
  age: 1,
  ...over,
});

function scene(splats: GooSplat[]) {
  const terrain = buildTerrainFromLevel(level);
  const world = createKnockoutWorld();
  world.splats = splats;
  const frame: KnockoutFrame = {
    world,
    zoom: 1,
    playerHeight: DEFAULT_GAME_TUNABLES.player.height,
    tunables: DEFAULT_GAME_TUNABLES.feel.knockout,
    respawnDelaySeconds: DEFAULT_GAME_TUNABLES.match.respawnDelaySeconds,
    terrain,
  };
  const view = createKnockoutView();
  syncKnockoutView(view, frame);
  return { view, frame, terrain, world };
}

const shapes = (g: { context: { instructions: unknown[] } } | undefined): number =>
  g?.context.instructions.length ?? 0;

describe("goo stains", () => {
  it("should colour the floor itself, inside its top edge, when goo landed on it", () => {
    const { view } = scene([splat({})]);
    const stain = view.stains.get("-1:1")!;
    expect(shapes(stain)).toBeGreaterThan(0);
    expect(stain.bounds.minY).toBeGreaterThanOrEqual(99.5);
    // It goes into the floor: deeper than a surface coat, no deeper than its reach.
    expect(stain.bounds.maxY).toBeGreaterThan(106);
    expect(stain.bounds.maxY).toBeLessThan(100 + STAIN_LOOK.reach * STAIN_LOOK.size.max * 5 + 4);
    expect(stain.alpha).toBe(STAIN_LOOK.alpha);
  });

  it("should draw nothing new when no stain changed stage and the terrain is the same", () => {
    const { view, frame, world } = scene([splat({})]);
    const before = view.stainKey;
    world.splats[0]!.age = 1.5;
    syncKnockoutView(view, frame);
    expect(view.stainKey).toBe(before);
    world.splats[0]!.age = 3;
    syncKnockoutView(view, frame);
    expect(view.stainKey).not.toBe(before);
  });

  it("should go with the ground when a blast takes the stained ground away", () => {
    const { view, frame, terrain } = scene([splat({})]);
    clearCrater(terrain, { x: 200, y: 100, reach: 40, shape: "round" });
    syncKnockoutView(view, frame);
    expect(shapes(view.stains.get("-1:1"))).toBe(0);
  });

  it("should stain a moving part in its own layer and follow the part when it moves", () => {
    const { view, frame, terrain } = scene([
      splat({ key: "8:c0", slot: 0, x: 140, y: 40, rides: { mover: 0 } }),
    ]);
    expect(shapes(view.stains.get("0:0"))).toBeGreaterThan(0);
    expect(view.stains.has("-1:0")).toBe(false);
    const mover = terrain.movers[0]!;
    mover.pose = { dx: 30, dy: 0, angle: 0.5 };
    syncKnockoutView(view, frame);
    const layer = view.partLayers.get(0)!;
    expect(layer.position.x).toBe(mover.pivot.x + 30);
    expect(layer.rotation).toBe(0.5);
  });

  it("should keep one drawing per player colour when two players' goo lands side by side", () => {
    const { view } = scene([splat({}), splat({ key: "9:d1", slot: 2, x: 260 })]);
    expect(shapes(view.stains.get("-1:1"))).toBeGreaterThan(0);
    expect(shapes(view.stains.get("-1:2"))).toBeGreaterThan(0);
    expect(view.stains.get("-1:2")!.bounds.minX).toBeGreaterThan(
      view.stains.get("-1:1")!.bounds.maxX
    );
  });
});
