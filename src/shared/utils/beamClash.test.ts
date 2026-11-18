import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import type { SampleField } from "@/shared/types/sampleFront.types";
import { resolveBeamClashes, type ClashBeam } from "@/shared/utils/beamClash";
import { elementPairReaction } from "@/shared/utils/elementPairs";

const TORCH = DEFAULT_GAME_TUNABLES.combat.torch;
const RAY = DEFAULT_GAME_TUNABLES.combat.freezeRay;
const LOOK = DEFAULT_GAME_TUNABLES.combat.beamClash;
const CELL = 4;

/** An empty 600 × 300 field, with solid samples where `solid` says so. */
const field = (solid: (x: number, y: number) => boolean = () => false): SampleField => {
  const widthCells = 150;
  const heightCells = 75;
  const cells = new Uint8Array(widthCells * heightCells);
  for (let cy = 0; cy < heightCells; cy += 1) {
    for (let cx = 0; cx < widthCells; cx += 1) {
      if (solid(cx * CELL + CELL / 2, cy * CELL + CELL / 2)) cells[cy * widthCells + cx] = 1;
    }
  }
  return { cellSize: CELL, widthCells, heightCells, cells };
};

const torchAt = (x: number, y: number, aim = { x: 1, y: 0 }): ClashBeam => ({
  origin: { x, y },
  aim,
  shape: TORCH,
  element: "fire",
});
const rayAt = (x: number, y: number, aim = { x: -1, y: 0 }): ClashBeam => ({
  origin: { x, y },
  aim,
  shape: RAY,
  element: "cold",
});

describe("elementPairReaction (the element × element table)", () => {
  it("should cancel when fire meets cold, either way round", () => {
    expect(elementPairReaction("fire", "cold")).toBe("cancel");
    expect(elementPairReaction("cold", "fire")).toBe("cancel");
  });

  it("should not react when two elements are the same or the table has no row for them", () => {
    expect(elementPairReaction("fire", "fire")).toBeNull();
    expect(elementPairReaction("cold", "cold")).toBeNull();
    expect(elementPairReaction("fire", "acid")).toBeNull();
  });
});

describe("resolveBeamClashes", () => {
  it("should end both beams halfway when a torch and a freeze ray spray head-on", () => {
    const { reach, clashes } = resolveBeamClashes(
      [{ field: field() }],
      [torchAt(100, 150), rayAt(230, 150)],
      LOOK
    );

    // 130 apart: they meet 65 from each emitter, within the touching distance and a sample.
    expect(reach[0]).toBeGreaterThan(65 - LOOK.thickness - CELL);
    expect(reach[0]).toBeLessThan(65 + 1);
    expect(reach[1]).toBeCloseTo(reach[0] ?? 0, 5);
    expect(clashes).toHaveLength(1);
    expect(clashes[0]?.reaction).toBe("cancel");
    expect(clashes[0]?.at.x).toBeGreaterThan(150);
    expect(clashes[0]?.at.x).toBeLessThan(180);
  });

  it("should leave nothing of either beam past the meeting when they spray head-on", () => {
    const { reach } = resolveBeamClashes(
      [{ field: field() }],
      [torchAt(100, 150), rayAt(230, 150)],
      LOOK
    );

    // The torch's far end and the ray's far end do not cross.
    expect(100 + (reach[0] ?? 0)).toBeLessThanOrEqual(
      230 - (reach[1] ?? 0) + LOOK.thickness + CELL
    );
  });

  it("should end only the freeze ray when it meets the flame beyond the torch's own length", () => {
    // 200 apart: the flame ends 84 out by itself; the ray gets there later and ends on it.
    const { reach, clashes } = resolveBeamClashes(
      [{ field: field() }],
      [torchAt(100, 150), rayAt(300, 150)],
      LOOK
    );

    expect(reach[0]).toBe(TORCH.length);
    expect(reach[1]).toBeLessThan(200 - TORCH.length + 1);
    expect(reach[1]).toBeGreaterThan(200 - TORCH.length - LOOK.thickness - CELL);
    expect(clashes).toHaveLength(1);
  });

  it("should end the freeze ray on the flame's side when it crosses the flame at an angle", () => {
    // The ray comes down from the upper right and crosses the flame 40 units from the torch.
    const aim = { x: -150, y: 90 };
    const length = Math.hypot(aim.x, aim.y);
    const ray = rayAt(140 + (150 * 150) / length, 150 - (90 * 150) / length, aim);
    const { reach, clashes } = resolveBeamClashes(
      [{ field: field() }],
      [torchAt(100, 150), ray],
      LOOK
    );

    expect(reach[0]).toBe(TORCH.length);
    // It ends before it reaches the torch's aim line, at the flame: no further from the torch
    // than the flame goes, give or take the touching distance and a sample.
    const end = {
      x: ray.origin.x + (aim.x / length) * (reach[1] ?? 0),
      y: ray.origin.y + (aim.y / length) * (reach[1] ?? 0),
    };
    expect(reach[1]).toBeLessThan(150);
    expect(end.y).toBeLessThan(150);
    expect(Math.hypot(end.x - 100, end.y - 150)).toBeLessThan(TORCH.length + LOOK.thickness + CELL);
    expect(clashes).toHaveLength(1);
  });

  it("should end the freeze ray when it only grazes the edge of the flame", () => {
    // The ray flies 20 units above the torch's aim line: the cone is that wide about 62 out.
    const { reach, clashes } = resolveBeamClashes(
      [{ field: field() }],
      [torchAt(100, 150), rayAt(260, 130)],
      LOOK
    );

    expect(clashes).toHaveLength(1);
    expect(reach[1]).toBeLessThan(RAY.length);
    expect(260 - (reach[1] ?? 0)).toBeGreaterThan(100);
  });

  it("should leave both beams whole when they do not touch", () => {
    const apart = resolveBeamClashes(
      [{ field: field() }],
      [torchAt(100, 150), rayAt(500, 150)],
      LOOK
    );
    const away = resolveBeamClashes(
      [{ field: field() }],
      [torchAt(100, 150, { x: -1, y: 0 }), rayAt(230, 150, { x: 1, y: 0 })],
      LOOK
    );

    for (const result of [apart, away]) {
      expect(result.reach).toEqual([TORCH.length, RAY.length]);
      expect(result.clashes).toEqual([]);
    }
  });

  it("should leave both beams whole when a wall stands between them", () => {
    const wall = field((x) => x > 160 && x < 172);
    const { reach, clashes } = resolveBeamClashes(
      [{ field: wall }],
      [torchAt(100, 150), rayAt(230, 150)],
      LOOK
    );

    expect(reach).toEqual([TORCH.length, RAY.length]);
    expect(clashes).toEqual([]);
  });

  it("should let two beams of the same element pass through each other", () => {
    const { reach, clashes } = resolveBeamClashes(
      [{ field: field() }],
      [torchAt(100, 150), torchAt(230, 150, { x: -1, y: 0 })],
      LOOK
    );

    expect(reach).toEqual([TORCH.length, TORCH.length]);
    expect(clashes).toEqual([]);
  });

  it("should return each beam's own length when fewer than two beams spray", () => {
    expect(resolveBeamClashes([{ field: field() }], [], LOOK)).toEqual({ reach: [], clashes: [] });
    expect(resolveBeamClashes([{ field: field() }], [rayAt(230, 150)], LOOK).reach).toEqual([
      RAY.length,
    ]);
  });
});

describe("resolveBeamClashes — the pair table", () => {
  it("should clash two beams of a new element pair when only the pair table gains a row", () => {
    // An acid beam where the freeze ray was: no clash with fire until the table says so.
    const beams = [torchAt(100, 150), { ...rayAt(230, 150), element: "acid" }];
    expect(resolveBeamClashes([{ field: field() }], beams, LOOK).clashes).toEqual([]);
    const pairs = { fire: { acid: "cancel" }, acid: { fire: "cancel" } } as const;
    const { reach, clashes } = resolveBeamClashes([{ field: field() }], beams, { ...LOOK, pairs });
    expect(clashes).toHaveLength(1);
    expect(reach[0]).toBeLessThan(TORCH.length);
  });
});
