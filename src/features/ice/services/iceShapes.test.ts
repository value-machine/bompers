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

const points = (flat: readonly number[]): { x: number; y: number }[] =>
  Array.from({ length: flat.length / 2 }, (_, i) => ({ x: flat[i * 2]!, y: flat[i * 2 + 1]! }));

describe("iceShapes — cold breath as a frost fan (freeze-ray-spread D1)", () => {
  it("should start thin at the emitter and run through every ray's own end when fully grown", () => {
    const shape = breathShape(beam(1), { timeSeconds: 0, grow: 1 });
    const outline = points(shape.neck);
    const first = outline[0]!;
    const last = outline[outline.length - 1]!;
    expect(first.x).toBeCloseTo(100 + ICE_LOOK.breath.emitterReach, 5);
    expect(Math.abs(first.y - last.y)).toBeCloseTo(ICE_LOOK.breath.neckStart * 2, 5);
    expect(outline.slice(1, -1)).toEqual(beam(1).ends);
  });

  it("should end each ray where the sim's ray ended when aimed at the floor in front", () => {
    const floor: FreezeRayBeam = {
      ...beam(1),
      ends: [
        { x: 140, y: 120 },
        { x: 190, y: 120 },
        { x: 280, y: 110 },
      ],
    };
    const outline = points(breathShape(floor, { timeSeconds: 0, grow: 1 }).neck).slice(1, -1);
    expect(outline).toEqual(floor.ends);
  });

  it("should put a frost puff on every ray's end and rolling lobes only where a ray landed", () => {
    const shape = breathShape(
      { ...beam(1), touched: [false, true, false] },
      { timeSeconds: 0, grow: 1 }
    );
    expect(shape.lobes).toHaveLength(3 + ICE_LOOK.breath.puffLobes);
    for (const end of beam(1).ends) {
      expect(shape.lobes.some((lobe) => lobe.x === end.x && lobe.y === end.y)).toBe(true);
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
