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
  it("should dye the floor itself, inside its top edge and into it, when goo landed on it", () => {
    const { view } = scene([splat({})]);
    const stain = view.stains.get("-1:7")!.g;
    expect(shapes(stain)).toBeGreaterThan(0);
    expect(stain.bounds.minY).toBeGreaterThanOrEqual(99.5);
    // It goes into the floor: deeper than a surface coat, no deeper than its reach.
    expect(stain.bounds.maxY).toBeGreaterThan(106);
    expect(stain.bounds.maxY).toBeLessThan(100 + STAIN_LOOK.reach * STAIN_LOOK.size.max * 5 + 4);
    expect(stain.alpha).toBe(STAIN_LOOK.alpha);
  });

  it("should fade evenly after the respawn without redrawing when the stain ages", () => {
    const { view, frame, world } = scene([splat({})]);
    const drawing = view.stains.get("-1:7")!;
    const drawn = drawing.drawn;
    const box = { ...drawing.g.bounds };
    const respawn = frame.respawnDelaySeconds;
    world.splats[0]!.age = (respawn + frame.tunables.splatSeconds) / 2;
    syncKnockoutView(view, frame);
    expect(drawing.drawn).toBe(drawn);
    expect(drawing.g.bounds.maxY).toBe(box.maxY);
    expect(drawing.g.alpha).toBeCloseTo(STAIN_LOOK.alpha / 2);
  });

  it("should draw one burst's goo as one shape and fade it as one when its droplets land together", () => {
    const { view, frame, world } = scene([splat({}), splat({ key: "7:d1", x: 212, age: 0.6 })]);
    expect(view.stains.size).toBe(1);
    const drawing = view.stains.get("-1:7")!;
    // The first landing is gone from the world; the burst keeps fading by it.
    world.splats = [splat({ key: "7:d1", x: 212, age: frame.tunables.splatSeconds - 0.4 })];
    drawing.age = frame.tunables.splatSeconds;
    syncKnockoutView(view, frame);
    expect(drawing.g.alpha).toBe(0);
  });

  it("should lay a later burst over an earlier one, each in its own colour, when two stack", () => {
    const { view } = scene([splat({}), splat({ key: "9:d1", slot: 2, x: 206 })]);
    const [first, second] = [view.stains.get("-1:7")!.g, view.stains.get("-1:9")!.g];
    expect(shapes(first)).toBeGreaterThan(0);
    expect(shapes(second)).toBeGreaterThan(0);
    expect(view.stainLayer.getChildIndex(second)).toBeGreaterThan(
      view.stainLayer.getChildIndex(first)
    );
    expect(second.bounds.minX).toBeLessThan(first.bounds.maxX);
  });

  it("should go with the ground when a blast takes the stained ground away", () => {
    const { view, frame, terrain } = scene([splat({})]);
    clearCrater(terrain, { x: 200, y: 100, reach: 40, shape: "round" });
    syncKnockoutView(view, frame);
    expect(shapes(view.stains.get("-1:7")!.g)).toBe(0);
  });

  it("should drop a burst's drawing when its last stain is gone", () => {
    const { view, frame, world } = scene([splat({})]);
    world.splats = [];
    syncKnockoutView(view, frame);
    expect(view.stains.size).toBe(0);
    expect(view.stainLayer.children).toHaveLength(0);
  });

  it("should stain a moving part in its own layer and follow the part when it moves", () => {
    const { view, frame, terrain } = scene([
      splat({ key: "8:c0", slot: 0, x: 140, y: 40, rides: { mover: 0 } }),
    ]);
    expect(shapes(view.stains.get("0:8")!.g)).toBeGreaterThan(0);
    expect(view.stains.has("-1:8")).toBe(false);
    const mover = terrain.movers[0]!;
    mover.pose = { dx: 30, dy: 0, angle: 0.5 };
    syncKnockoutView(view, frame);
    const layer = view.partLayers.get(0)!;
    expect(layer.position.x).toBe(mover.pivot.x + 30);
    expect(layer.rotation).toBe(0.5);
  });
});
