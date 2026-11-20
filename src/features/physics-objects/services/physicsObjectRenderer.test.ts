import { describe, expect, it } from "vitest";
import { JUICE_SQUASH, JUICE_WINDOWS } from "@/shared/config/gameJuice";
import { PHYSICS_OBJECT_JUICE } from "@/features/physics-objects/services/physicsObjectRenderer";

describe("physicsObjectRenderer juice", () => {
  it("should keep the ball's squash and effect timings inside the juice scale when drawn", () => {
    const { SQUASH_SECONDS, EFFECT_SECONDS, BOUNCE_WIDEN } = PHYSICS_OBJECT_JUICE;
    expect(SQUASH_SECONDS).toBeGreaterThanOrEqual(JUICE_WINDOWS.squash[0]);
    expect(SQUASH_SECONDS).toBeLessThanOrEqual(JUICE_WINDOWS.squash[1]);
    expect(EFFECT_SECONDS).toBeGreaterThanOrEqual(JUICE_WINDOWS.effect[0]);
    expect(EFFECT_SECONDS).toBeLessThanOrEqual(JUICE_WINDOWS.effect[1]);
    const sx = 1 + BOUNCE_WIDEN;
    const sy = 1 / sx;
    expect(sx).toBeLessThanOrEqual(JUICE_SQUASH.maxScale);
    expect(sy).toBeGreaterThanOrEqual(JUICE_SQUASH.minScale);
  });
});
