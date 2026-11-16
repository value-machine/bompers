import { describe, expect, it } from "vitest";
import { createDampedSpring, stepDampedSpring } from "@/shared/utils/dampedSpring";

const WOBBLY = { stiffness: 420, damping: 11 };

function run(spring = createDampedSpring(), seconds = 1, dt = 1 / 60) {
  const values: number[] = [];
  for (let t = 0; t < seconds; t += dt) {
    stepDampedSpring(spring, WOBBLY, dt);
    values.push(spring.value);
  }
  return values;
}

describe("stepDampedSpring", () => {
  it("should stay at rest when nothing kicked it", () => {
    expect(run().every((v) => v === 0)).toBe(true);
  });

  it("should overshoot past 0 and settle when kicked with an underdamped setting", () => {
    const spring = createDampedSpring();
    spring.velocity = 50;
    const values = run(spring, 1.5);
    expect(Math.max(...values)).toBeGreaterThan(0);
    expect(Math.min(...values)).toBeLessThan(0);
    expect(Math.abs(values[values.length - 1]!)).toBeLessThan(0.05);
  });

  it("should stay bounded when a frame is very long", () => {
    const spring = createDampedSpring();
    spring.velocity = 50;
    stepDampedSpring(spring, WOBBLY, 5);
    expect(Number.isFinite(spring.value)).toBe(true);
    expect(Math.abs(spring.value)).toBeLessThan(5);
  });

  it("should move the same at 30 and 144 fps when given the same time", () => {
    const a = createDampedSpring();
    const b = createDampedSpring();
    a.velocity = b.velocity = 40;
    run(a, 0.2, 1 / 30);
    run(b, 0.2, 1 / 144);
    expect(a.value).toBeCloseTo(b.value, 0);
  });
});
