import { describe, expect, it } from "vitest";
import { hashSeed, randomBetween, seededRandom } from "@/shared/utils/seededRandom";

const take = (random: () => number, n: number): number[] => Array.from({ length: n }, random);

describe("seededRandom", () => {
  it("should give the same sequence when the seed is the same", () => {
    expect(take(seededRandom(42), 5)).toEqual(take(seededRandom(42), 5));
  });

  it("should give different sequences when the seeds differ", () => {
    expect(take(seededRandom(1), 5)).not.toEqual(take(seededRandom(2), 5));
  });

  it("should stay in [0, 1) when drawn many times", () => {
    const values = take(seededRandom(7), 1000);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
  });

  it("should stay in [min, max) when a range is asked", () => {
    const random = seededRandom(3);
    for (let i = 0; i < 100; i++) {
      const v = randomBetween(random, 10, 20);
      expect(v).toBeGreaterThanOrEqual(10);
      expect(v).toBeLessThan(20);
    }
  });
});

describe("hashSeed", () => {
  it("should be stable and differ per text when hashing ids", () => {
    expect(hashSeed("forest#1")).toBe(hashSeed("forest#1"));
    expect(hashSeed("forest#1")).not.toBe(hashSeed("forest#2"));
    // FNV-1a 32-bit of the empty string is its offset basis.
    expect(hashSeed("")).toBe(0x811c9dc5);
  });
});
