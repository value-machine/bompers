import { describe, expect, it } from "vitest";
import { advanceFixedStep, createFixedStepClock } from "@/shared/services/gameLoop";

const options = { stepSeconds: 1 / 120, maxSteps: 8 };

describe("gameLoop", () => {
  it("should run two fixed steps when a 60 fps frame passes at 120 Hz", () => {
    const { steps, clock } = advanceFixedStep(createFixedStepClock(), 1 / 60, options);
    expect(steps).toBe(2);
    expect(clock.accumulator).toBeCloseTo(0, 9);
  });

  it("should carry leftover time to the next frame when a frame is shorter than a step", () => {
    const first = advanceFixedStep(createFixedStepClock(), 0.005, options);
    expect(first.steps).toBe(0);
    const second = advanceFixedStep(first.clock, 0.005, options);
    expect(second.steps).toBe(1);
  });

  it("should cap the steps and drop the backlog when the tab stalled", () => {
    const { steps, clock } = advanceFixedStep(createFixedStepClock(), 2, options);
    expect(steps).toBe(8);
    expect(clock.accumulator).toBe(0);
  });

  it("should ignore negative frame times when the clock jumps back", () => {
    expect(advanceFixedStep(createFixedStepClock(), -1, options).steps).toBe(0);
  });
});
