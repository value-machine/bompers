import { describe, expect, it } from "vitest";
import { JUICE_WINDOWS } from "@/shared/config/gameJuice";
import { inkStroke, outlineWidth } from "@/shared/utils/outlineWidth";
import {
  ICE_LOOK,
  breathRelease,
  breathShape,
  breathStroke,
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

describe("iceShapes — cold breath as one cloud shape (freeze-ray-shape D1)", () => {
  const floor: FreezeRayBeam = {
    ...beam(1),
    ends: [
      { x: 140, y: 120 },
      { x: 190, y: 120 },
      { x: 280, y: 110 },
    ],
  };
  const xs = (shape: { outline: { points: number[] }[] }): number[] =>
    shape.outline.flatMap((ring) => ring.points.filter((_, i) => i % 2 === 0));

  it("should draw the whole spray as closed outline rings, not separate circles", () => {
    for (const timeSeconds of [0, 0.37, 1.1, 2.9]) {
      const shape = breathShape(beam(1), { timeSeconds, grow: 1 });
      expect(shape.outline.length).toBeGreaterThan(0);
      expect(shape.outline.length).toBeLessThan(ICE_LOOK.breath.stream.perRay * 3);
      expect(shape.outline.every((ring) => ring.closed)).toBe(true);
    }
  });

  it("should reach far with its top while it ends near the floor in front when aimed at the floor", () => {
    let far = 0;
    for (let t = 0; t < 3; t += 0.1)
      far = Math.max(far, ...xs(breathShape(floor, { timeSeconds: t, grow: 1 })));
    expect(far).toBeGreaterThan(250);
    // Nothing passes the top ray's end by more than a grown puff's reach.
    const { radius, grow } = ICE_LOOK.breath.stream;
    expect(far).toBeLessThan(280 + (radius + grow) * ICE_LOOK.breath.field.reach + 1);
  });

  it("should keep the lighter inside within the outline's extent", () => {
    const shape = breathShape(beam(1), { timeSeconds: 0.4, grow: 1 });
    const outer = xs(shape);
    const inner = shape.inner.flatMap((ring) => ring.points.filter((_, i) => i % 2 === 0));
    expect(Math.max(...inner)).toBeLessThanOrEqual(Math.max(...outer));
    expect(Math.min(...inner)).toBeGreaterThanOrEqual(Math.min(...outer));
  });

  it("should stroke its outline with the shared outline width and ink stroke at every zoom", () => {
    for (const zoom of [0.3, 1, 2.5, 6]) {
      expect(breathStroke(zoom)).toEqual(inkStroke(outlineWidth("effect", zoom).width, "ice"));
    }
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
