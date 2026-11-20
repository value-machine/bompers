import { describe, expect, it } from "vitest";
import { placeObject } from "@/features/level-objects/services/objectPlacement";
import { TREE_RECIPE } from "@/features/level-objects/services/treeRecipe";

const box = { x: 100, y: 100, w: 120, h: 200 };

describe("placeObject", () => {
  it("should refuse when the kind is unknown", () => {
    expect(placeObject({ kind: "rock", box, seed: 1 })).toEqual({
      ok: false,
      reason: "unknown-kind",
    });
  });

  it("should refuse when the kind is a prototype name", () => {
    expect(placeObject({ kind: "toString", box, seed: 1 }).ok).toBe(false);
  });

  it("should keep the box and add no notes when it fits the variant", () => {
    const placed = placeObject({ kind: "tree", variant: "pine", box, seed: 1 });
    expect(placed).toMatchObject({ ok: true, variant: "pine", box, notes: [] });
  });

  it("should clamp the height and keep the bottom centre when the box is too tall", () => {
    const placed = placeObject({
      kind: "tree",
      variant: "pine",
      box: { x: 0, y: 0, w: 200, h: 1000 },
      seed: 1,
    });
    if (!placed.ok) throw new Error("expected a tree");
    expect(placed.box.h).toBe(TREE_RECIPE.height.max);
    expect(placed.box.y + placed.box.h).toBe(1000);
    expect(placed.box.x + placed.box.w / 2).toBe(100);
    expect(placed.notes[0]).toContain("height 1000");
  });

  it("should clamp the width to the variant's aspect when the box is too wide", () => {
    const placed = placeObject({
      kind: "tree",
      variant: "pine",
      box: { x: 0, y: 0, w: 400, h: 200 },
      seed: 1,
    });
    if (!placed.ok) throw new Error("expected a tree");
    expect(placed.box.w).toBe(150);
    expect(placed.box.x).toBe(125);
    expect(placed.notes[0]).toContain("width 400");
  });

  it("should use the default variant with a note when the variant is unknown", () => {
    const placed = placeObject({ kind: "tree", variant: "birch", box, seed: 1 });
    expect(placed).toMatchObject({ ok: true, variant: TREE_RECIPE.defaultVariant });
    if (placed.ok) expect(placed.notes.join()).toContain('unknown tree variant "birch"');
  });

  it("should pick the same variant per seed and more than one across seeds when none is named", () => {
    const pick = (seed: number) => {
      const placed = placeObject({ kind: "tree", box: { x: 0, y: 0, w: 160, h: 200 }, seed });
      return placed.ok ? placed.variant : "";
    };
    expect(pick(3)).toBe(pick(3));
    const picks = new Set(Array.from({ length: 40 }, (_, i) => pick(i)));
    expect(picks.size).toBeGreaterThan(2);
  });

  it("should turn every part about the rotation point when a rotation is given", () => {
    const upright = placeObject({ kind: "tree", variant: "oak", box, seed: 7 });
    const turned = placeObject({
      kind: "tree",
      variant: "oak",
      box,
      seed: 7,
      rotation: { degrees: 180, about: { x: 160, y: 300 } },
    });
    if (!upright.ok || !turned.ok) throw new Error("expected placements");
    expect(turned.rotation).toEqual({ degrees: 180, about: { x: 160, y: 300 } });
    const ys = (parts: typeof upright.parts): number[] =>
      parts.flatMap(({ shape }) => {
        if (shape.type === "circle") return [shape.cy];
        return shape.type === "polygon" ? shape.points.map((p) => p.y) : [];
      });
    // Upside down about its base: everything that stood above y 300 now hangs below it.
    expect(Math.max(...ys(upright.parts))).toBeLessThanOrEqual(300.01);
    expect(Math.min(...ys(turned.parts))).toBeGreaterThanOrEqual(299.99);
  });

  it("should leave the parts upright when the rotation is a whole turn", () => {
    const placed = placeObject({
      kind: "tree",
      box,
      seed: 3,
      rotation: { degrees: 360, about: { x: 0, y: 0 } },
    });
    expect(placed).toEqual(placeObject({ kind: "tree", box, seed: 3 }));
  });

  it("should place a ball as a square physics body with no parts when its rect is not square", () => {
    const placed = placeObject({ kind: "ball", box: { x: 100, y: 100, w: 80, h: 48 }, seed: 1 });
    expect(placed).toMatchObject({
      ok: true,
      objectClass: "physics",
      variant: "beach",
      box: { x: 116, y: 100, w: 48, h: 48 },
      parts: [],
    });
  });
});
