import { describe, expect, it } from "vitest";
import { SPLAT_SIZE, splatShape } from "@/features/knockout/services/splatShape";

const floor = (key: string) => splatShape({ key, nx: 0, ny: -1, radius: 10 });

describe("splatShape", () => {
  it("should give the same shape every time when the key is the same", () => {
    expect(floor("7:d1")).toEqual(floor("7:d1"));
  });

  it("should vary size and lobes when the keys differ", () => {
    const shapes = ["7:d0", "7:d1", "7:d2", "8:d0", "8:d1", "9:d4"].map(floor);
    const widths = new Set(shapes.map((shape) => shape.blobs[0]!.rx.toFixed(3)));
    const blobCounts = new Set(shapes.map((shape) => shape.blobs.length));
    expect(widths.size).toBe(shapes.length);
    expect(blobCounts.size).toBeGreaterThan(1);
  });

  it("should be bigger than the old fixed lens (2.3 × radius) when on a floor", () => {
    for (const key of ["1:d0", "2:d3", "3:d5"]) {
      const lens = floor(key).blobs[0]!;
      expect(lens.rx).toBeGreaterThanOrEqual(2.3 * 10 * SPLAT_SIZE.min);
      expect(lens.rx).toBeLessThanOrEqual(2.3 * 10 * SPLAT_SIZE.max);
    }
  });

  it("should lay out a streak on a wall and drips under a ceiling when the normal says so", () => {
    expect(splatShape({ key: "5:d0", nx: 1, ny: 0, radius: 10 }).streak).toBeGreaterThan(0);
    const ceiling = splatShape({ key: "5:d1", nx: 0, ny: 1, radius: 10 });
    expect(ceiling.drips.length).toBeGreaterThanOrEqual(1);
    expect(ceiling.blobs).toEqual([]);
  });
});
