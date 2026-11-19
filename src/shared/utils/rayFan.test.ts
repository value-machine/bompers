import { describe, expect, it } from "vitest";
import type { PosedField, SampleField } from "@/shared/types/sampleFront.types";
import { castRayFan } from "@/shared/utils/rayFan";

const CELL = 4;

/** A `w` × `h` field of samples, solid where `solid` says so. */
const field = (w: number, h: number, solid: (cx: number, cy: number) => boolean): SampleField => {
  const cells = new Uint8Array(w * h);
  for (let cy = 0; cy < h; cy += 1)
    for (let cx = 0; cx < w; cx += 1) if (solid(cx, cy)) cells[cy * w + cx] = 1;
  return { cellSize: CELL, widthCells: w, heightCells: h, cells };
};

/** An empty 400 × 200 world and a solid 2 × 10 block field placed with its corner at `at`. */
const worldWithBlockAt = (at: { x: number; y: number } | null): PosedField[] => [
  { field: field(100, 50, () => false) },
  {
    field: field(2, 10, () => true),
    toLocal: (p) => (at ? { x: p.x - at.x, y: p.y - at.y } : null),
  },
];

const cast = (fields: PosedField[]) =>
  castRayFan({
    fields,
    bodies: [],
    origin: { x: 100, y: 100 },
    aim: { x: 1, y: 0 },
    shape: { length: 120, halfAngleDegrees: 0, rays: 1 },
  }).rays[0]!;

describe("ray fan over placed fields (mover-materials D4)", () => {
  it("should stop on a placed field and name it when the field lies on the ray", () => {
    const hit = cast(worldWithBlockAt({ x: 160, y: 80 }));
    expect(hit.body).toBe(1);
    // Row 5 of the block (y 100–104), its first column.
    expect(hit.sample).toBe(5 * 2);
    expect(hit.end.x).toBeGreaterThanOrEqual(160);
    expect(hit.end.x).toBeLessThan(160 + CELL);
  });

  it("should run its full length when the placed field is out of reach", () => {
    const hit = cast(worldWithBlockAt(null));
    expect(hit.sample).toBeNull();
    expect(hit.end.x).toBeCloseTo(220, 6);
  });

  it("should stop on the first field when both are solid at the same point", () => {
    const fields = worldWithBlockAt({ x: 160, y: 80 });
    fields[0] = { field: field(100, 50, (cx) => cx === 40) };
    const hit = cast(fields);
    expect(hit.body).toBe(0);
    expect(hit.sample).toBe(25 * 100 + 40);
  });
});

describe("ray fan bodies (crouch-sink D4)", () => {
  const empty = (): PosedField[] => [{ field: field(100, 50, () => false) }];
  const body = { x: 200, y: 150, width: 28, height: 28 };
  const hits = (originY: number, hitHeight?: number): boolean =>
    castRayFan({
      fields: empty(),
      bodies: [body],
      hitHeight: hitHeight === undefined ? undefined : () => hitHeight,
      origin: { x: 100, y: originY },
      aim: { x: 1, y: 0 },
      shape: { length: 200, halfAngleDegrees: 0, rays: 1 },
    }).bodies.has(body);

  it("should hit a body high up and miss it when its hit height is lowered below the ray", () => {
    expect(hits(150 - 22)).toBe(true);
    expect(hits(150 - 22, 16.8)).toBe(false);
  });

  it("should still hit a lowered body when the ray runs along its lower half", () => {
    expect(hits(150 - 6, 16.8)).toBe(true);
  });
});
