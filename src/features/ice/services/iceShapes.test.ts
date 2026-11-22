import { describe, expect, it } from "vitest";
import { JUICE_WINDOWS } from "@/shared/config/gameJuice";
import {
  ICE_LOOK,
  breathRelease,
  breathShape,
  frostGloss,
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

describe("iceShapes — cold breath as a mist cloud (freeze-ray-spray D1)", () => {
  const floor: FreezeRayBeam = {
    ...beam(1),
    ends: [
      { x: 140, y: 120 },
      { x: 190, y: 120 },
      { x: 280, y: 110 },
    ],
  };

  it("should keep every mist puff within reach of the ray it travels on when aimed at the floor", () => {
    const { stream } = ICE_LOOK.breath;
    const slack = stream.wobble + stream.rise + 1;
    for (const timeSeconds of [0, 0.37, 1.1, 2.9]) {
      const shape = breathShape(floor, { timeSeconds, grow: 1 });
      expect(shape.stream).toHaveLength(floor.ends.length * stream.perRay);
      shape.stream.forEach((puff, i) => {
        const end = floor.ends[Math.floor(i / stream.perRay)]!;
        const reach = Math.hypot(end.x - 100, end.y - 100);
        expect(Math.hypot(puff.x - 100, puff.y - 100)).toBeLessThan(reach + slack);
      });
    }
  });

  it("should reach far on the top ray while the low ray ends at the floor in front", () => {
    const { perRay } = ICE_LOOK.breath.stream;
    const furthest = (ray: number): number => {
      let best = 0;
      for (let t = 0; t < 3; t += 0.05) {
        const shape = breathShape(floor, { timeSeconds: t, grow: 1 });
        for (const puff of shape.stream.slice(ray * perRay, (ray + 1) * perRay))
          best = Math.max(best, puff.x);
      }
      return best;
    };
    expect(furthest(0)).toBeLessThan(150);
    expect(furthest(2)).toBeGreaterThan(250);
  });

  it("should grow each puff as it travels out", () => {
    const shape = breathShape(beam(1), { timeSeconds: 0.4, grow: 1 });
    const order = shape.streamAlong.map((along, i) => ({ along, r: shape.stream[i]!.r }));
    order.sort((a, b) => a.along - b.along);
    expect(order[0]!.r).toBeLessThan(order[order.length - 1]!.r);
  });

  it("should burst puffs only where a ray landed", () => {
    const shape = breathShape(
      { ...beam(1), touched: [false, true, false] },
      { timeSeconds: 0, grow: 1 }
    );
    expect(shape.lobes).toHaveLength(ICE_LOOK.breath.burstPuffs);
    for (const lobe of shape.lobes)
      expect(Math.hypot(lobe.x - 280, lobe.y - 100)).toBeLessThan(ICE_LOOK.breath.burstRadius * 2);
  });

  it("should keep its head on the middle ray's end so the release lets go where the ice is", () => {
    const shape = breathShape(beam(-1), { timeSeconds: 0, grow: 1 });
    expect(shape.head).toEqual(beam(-1).ends[1]);
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
  it("should streak only blocks with frozen ground all round when a patch is frozen", () => {
    const blocks = new Map<number, { bx: number; by: number }>();
    const stride = 100;
    for (let by = 0; by < 12; by += 1) {
      for (let bx = 0; bx < 12; bx += 1) blocks.set(by * stride + bx, { bx, by });
    }
    const gloss = frostGloss(blocks, { size: 8, stride });
    expect(gloss.length).toBeGreaterThan(0);
    for (const { a, b } of gloss) {
      for (const p of [a, b]) {
        expect(p.x).toBeGreaterThan(8);
        expect(p.x).toBeLessThan(11 * 8);
        expect(p.y).toBeGreaterThan(8);
        expect(p.y).toBeLessThan(11 * 8);
      }
    }
  });
});
