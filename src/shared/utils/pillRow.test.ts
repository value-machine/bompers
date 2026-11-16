import { describe, expect, it } from "vitest";
import { pillRow } from "@/shared/utils/pillRow";

describe("pillRow", () => {
  it("should span the row width with one pill per slot when given a count", () => {
    const pills = pillRow({ count: 6, filled: 6, width: 100, gap: 4 });
    expect(pills).toHaveLength(6);
    const last = pills[pills.length - 1];
    expect(pills[0]?.x).toBe(0);
    expect((last?.x ?? 0) + (last?.w ?? 0)).toBeCloseTo(100);
  });

  it("should fill only the first pills when some are spent", () => {
    const filled = pillRow({ count: 6, filled: 2, width: 100, gap: 4 }).map((p) => p.filled);
    expect(filled).toEqual([true, true, false, false, false, false]);
  });

  it("should keep the health chunk size when four pills span the health row", () => {
    // Ground truth: DESIGN_LANGUAGE § 7 health chunks, 22 wide with 4 gaps (row 4·26 − 4 = 100).
    const pills = pillRow({ count: 4, filled: 3, width: 100, gap: 4 });
    expect(pills.map((p) => [p.x, p.w])).toEqual([
      [0, 22],
      [26, 22],
      [52, 22],
      [78, 22],
    ]);
  });

  it("should return no pills when the count is zero", () => {
    expect(pillRow({ count: 0, filled: 0, width: 100, gap: 4 })).toEqual([]);
  });
});
