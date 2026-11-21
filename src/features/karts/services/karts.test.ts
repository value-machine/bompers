import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import { JUICE_SQUASH, JUICE_WINDOWS } from "@/shared/config/gameJuice";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import { createPhysicsObjectsState } from "@/features/physics-objects/api/physicsObjectsApi";
import { chassisOf, kickSpring, stepSpring } from "@/features/karts/services/kartBody";
import { createKartsState } from "@/features/karts/services/karts";
import { KART_JUICE } from "@/features/karts/services/kartRenderer";

const level: LevelDefinition = {
  formatVersion: 1,
  meta: { levelId: "k", title: "K" },
  settings: { cellSize: 4, gravity: 1 },
  worldSize: { w: 800, h: 400 },
  terrain: [{ shape: { type: "rect", x: 0, y: 320, w: 800, h: 32 }, materialId: "stone" }],
  spawns: [{ x: 100, y: 300 }],
  drops: [],
  collectibles: [],
  bounds: { x: -100, y: -100, w: 1000, h: 600 },
  objects: [
    {
      kind: "kart",
      variant: "go-kart",
      box: { x: 376, y: 288, w: 64, h: 32 },
      seed: 1,
      terrainIndices: [],
    },
    {
      kind: "ball",
      variant: "beach",
      box: { x: 100, y: 272, w: 48, h: 48 },
      seed: 2,
      terrainIndices: [],
    },
  ],
};

const newKart = () => {
  const physics = createPhysicsObjectsState(level);
  const karts = createKartsState(level, physics);
  return { physics, kart: karts.karts[0]! };
};

describe("createKartsState", () => {
  it("should add two half-weight wheels at the bottom of the kart's rect when the level places a kart", () => {
    const { physics, kart } = newKart();
    expect(physics.objects).toHaveLength(3);
    const [left, right] = kart.wheels;
    expect(left.body).toMatchObject({ shape: "wheel", mass: kart.body.mass / 2 });
    expect(left.x).toBeLessThan(408);
    expect(right.x).toBeGreaterThan(408);
    expect(left.y + left.radius).toBeCloseTo(320, 5);
    // The chassis sits above the wheels, inside the rect.
    const chassis = chassisOf(kart);
    expect(chassis.center.y).toBeLessThan(left.y);
    expect(chassis.center.y - chassis.radius).toBeGreaterThanOrEqual(288);
  });
});

describe("stepSpring", () => {
  it("should settle the chassis back to rest inside the juice settle window when it was kicked", () => {
    const { kart } = newKart();
    kickSpring(kart, { x: 0, y: 140 });
    const dt = 1 / 120;
    let settledAt = Infinity;
    for (let t = 0; t < 1; t += dt) {
      stepSpring(kart, { dt, tunables: DEFAULT_GAME_TUNABLES });
      const away = Math.hypot(kart.spring.x, kart.spring.y);
      if (away > 0.5) settledAt = Infinity;
      else if (settledAt === Infinity) settledAt = t;
    }
    expect(settledAt).toBeLessThanOrEqual(JUICE_WINDOWS.settle[1]);
    const travel = DEFAULT_GAME_TUNABLES.karts.springTravel * kart.height;
    expect(Math.hypot(kart.spring.x, kart.spring.y)).toBeLessThanOrEqual(travel);
  });
});

describe("kartRenderer juice", () => {
  it("should keep the kart's squash and pop-in inside the juice scale when drawn", () => {
    const sx = 1 + KART_JUICE.SPRING_WIDEN;
    expect(sx).toBeLessThanOrEqual(JUICE_SQUASH.maxScale);
    expect(1 / sx).toBeGreaterThanOrEqual(JUICE_SQUASH.minScale);
    expect(KART_JUICE.EFFECT_SECONDS).toBeGreaterThanOrEqual(JUICE_WINDOWS.effect[0]);
    expect(KART_JUICE.EFFECT_SECONDS).toBeLessThanOrEqual(JUICE_WINDOWS.effect[1]);
  });
});
