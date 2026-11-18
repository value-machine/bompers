import { describe, expect, it } from "vitest";
import { JUICE_WINDOWS } from "@/shared/config/gameJuice";
import {
  ICE_LOOK,
  breathRelease,
  breathShape,
  frozenShapes,
} from "@/features/ice/services/iceShapes";
import type { FreezeRayBeam } from "@/features/ice/types/ice.types";

const beam = (aimX: 1 | -1): FreezeRayBeam => ({
  slot: 0,
  origin: { x: 100, y: 100 },
  ends: [
    { x: 100 + aimX * 180, y: 91 },
    { x: 100 + aimX * 180, y: 100 },
    { x: 100 + aimX * 180, y: 109 },
  ],
  touched: [true, true, true],
  atSeconds: 0,
});

const points = (flat: readonly number[]): { x: number; y: number }[] =>
  Array.from({ length: flat.length / 2 }, (_, i) => ({ x: flat[i * 2]!, y: flat[i * 2 + 1]! }));

describe("iceShapes — cold breath (ice-element D9)", () => {
  it("should start thin at the emitter and be widest by the head when fully grown", () => {
    const shape = breathShape(beam(1), { timeSeconds: 0, grow: 1 });
    const neck = points(shape.neck);
    const half = neck.length / 2;
    const widthAt = (i: number): number => Math.abs(neck[i]!.y - neck[neck.length - 1 - i]!.y);
    expect(neck[0]!.x).toBeCloseTo(100 + ICE_LOOK.breath.emitterReach, 5);
    expect(widthAt(0)).toBeLessThan(widthAt(half - 1));
  });

  it("should put its head near the end of the middle ray so it lands where the ice does", () => {
    const shape = breathShape(beam(1), { timeSeconds: 0, grow: 1 });
    expect(shape.head.x).toBeGreaterThan(100 + 180 * 0.85);
    expect(shape.head.x).toBeLessThan(100 + 180);
    expect(shape.lobes).toHaveLength(ICE_LOOK.breath.lobes + 1);
  });

  it("should hide the neck's end corners inside the head whatever the lobes are doing", () => {
    for (const timeSeconds of [0, 0.37, 1.1, 2.9]) {
      const shape = breathShape(beam(1), { timeSeconds, grow: 1 });
      const neck = points(shape.neck);
      const half = neck.length / 2;
      for (const corner of [neck[half - 1]!, neck[half]!]) {
        const covered = shape.lobes.some(
          (lobe) => Math.hypot(corner.x - lobe.x, corner.y - lobe.y) < lobe.r
        );
        expect(covered).toBe(true);
      }
    }
  });

  it("should lift toward the top of the screen whichever way the ray points", () => {
    for (const aimX of [1, -1] as const) {
      const shape = breathShape(beam(aimX), { timeSeconds: 0, grow: 1 });
      expect(shape.head.y).toBeLessThan(100);
    }
  });

  it("should be shorter while it grows in", () => {
    const young = breathShape(beam(1), { timeSeconds: 0, grow: 0.3 });
    const grown = breathShape(beam(1), { timeSeconds: 0, grow: 1 });
    expect(young.head.x).toBeLessThan(grown.head.x);
    expect(young.headRadius).toBeLessThan(grown.headRadius);
  });

  it("should let snow specks fall below the breath", () => {
    const shape = breathShape(beam(1), { timeSeconds: 0.4, grow: 1 });
    expect(shape.specks).toHaveLength(ICE_LOOK.breath.specks);
    expect(shape.specks.every((speck) => speck.y > 100)).toBe(true);
  });

  it("should rise and shrink to nothing when the head lets go", () => {
    const last = { head: { x: 260, y: 96 }, radius: 12 };
    const early = breathRelease(last, 0.1);
    const late = breathRelease(last, 0.9);
    expect(late[1]!.y).toBeLessThan(early[1]!.y);
    expect(late[1]!.r).toBeLessThan(early[1]!.r);
    expect(breathRelease(last, 1).every((puff) => puff.r === 0)).toBe(true);
  });

  it("should keep its grow-in and release inside the juice windows", () => {
    const { growSeconds, releaseSeconds } = ICE_LOOK.breath;
    const windows = Object.values(JUICE_WINDOWS);
    const fits = (seconds: number): boolean =>
      windows.some(([min, max]) => seconds >= min && seconds <= max);
    expect(fits(growSeconds)).toBe(true);
    expect(fits(releaseSeconds)).toBe(true);
  });
});

describe("iceShapes — frozen ground (ice-element D4)", () => {
  it("should cost one body slab per row run and a lip on top edges only", () => {
    const blocks = new Map<number, { bx: number; by: number }>();
    const stride = 100;
    for (let by = 0; by < 3; by += 1) {
      for (let bx = 0; bx < 5; bx += 1) blocks.set(by * stride + bx, { bx, by });
    }
    const shapes = frozenShapes(blocks, { size: 8, stride });
    expect(shapes.body).toHaveLength(3);
    expect(shapes.lip).toHaveLength(1);
    expect(shapes.lip[0]!.y).toBe(0);
  });
});
