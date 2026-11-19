import { describe, expect, it } from "vitest";
import type { Rect, Shape2D } from "@/shared/types/gameGeometry.types";
import { seededRandom } from "@/shared/utils/seededRandom";
import { hasCatalogEntry } from "@/features/content-catalog/api/contentCatalogApi";
import { MIN_PART_THICKNESS } from "@/features/level-objects/services/objectParts";
import { TREE_RECIPE } from "@/features/level-objects/services/treeRecipe";

const BOX: Rect = { x: 400, y: 200, w: 160, h: 240 };
/** Half a terrain sample: what the field can't tell apart anyway. */
const SLACK = 2;

function extent(shape: Shape2D): Rect {
  if (shape.type === "circle") {
    return { x: shape.cx - shape.r, y: shape.cy - shape.r, w: 2 * shape.r, h: 2 * shape.r };
  }
  if (shape.type === "rect") return shape;
  const xs = shape.points.map((p) => p.x);
  const ys = shape.points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** A box that fits each variant's aspect range at BOX's height. */
const boxFor = (aspect: { min: number; max: number }): Rect => {
  const w = Math.round(BOX.h * (aspect.min + aspect.max) * 0.5);
  return { ...BOX, x: BOX.x + (BOX.w - w) / 2, w };
};

describe("TREE_RECIPE", () => {
  for (const variant of TREE_RECIPE.variants) {
    const box = boxFor(variant.aspect);

    it(`should build the same ${variant.id} when the seed is the same`, () => {
      expect(variant.build(box, seededRandom(5))).toEqual(variant.build(box, seededRandom(5)));
    });

    it(`should build a different ${variant.id} when the seed differs`, () => {
      expect(variant.build(box, seededRandom(5))).not.toEqual(variant.build(box, seededRandom(6)));
    });

    it(`should keep every ${variant.id} part inside its box when built at several sizes`, () => {
      for (const h of [TREE_RECIPE.height.min, 240, TREE_RECIPE.height.max]) {
        for (const ratio of [variant.aspect.min, variant.aspect.max]) {
          const sized: Rect = { x: 0, y: 0, w: h * ratio, h };
          for (const seed of [1, 2, 3]) {
            for (const part of variant.build(sized, seededRandom(seed))) {
              const e = extent(part.shape);
              expect(e.x).toBeGreaterThanOrEqual(sized.x - SLACK);
              expect(e.y).toBeGreaterThanOrEqual(sized.y - SLACK);
              expect(e.x + e.w).toBeLessThanOrEqual(sized.x + sized.w + SLACK);
              expect(e.y + e.h).toBeLessThanOrEqual(sized.y + sized.h + SLACK);
            }
          }
        }
      }
    });

    it(`should use catalog materials and colours and stand on the box when building a ${variant.id}`, () => {
      const parts = variant.build(box, seededRandom(9));
      for (const part of parts) {
        expect(hasCatalogEntry("material", part.materialId)).toBe(true);
        expect(hasCatalogEntry("color", part.colorId)).toBe(true);
      }
      const bottom = Math.max(...parts.map((p) => extent(p.shape).y + extent(p.shape).h));
      expect(bottom).toBeCloseTo(box.y + box.h, 0);
    });

    it(`should keep circles at least two samples wide when building the smallest ${variant.id}`, () => {
      const small: Rect = { x: 0, y: 0, w: 96 * variant.aspect.min, h: 96 };
      for (const part of variant.build(small, seededRandom(4))) {
        if (part.shape.type === "circle") {
          expect(2 * part.shape.r).toBeGreaterThanOrEqual(MIN_PART_THICKNESS);
        }
      }
    });
  }

  it("should make leaves burn and living trunks only scorch when reading the materials", () => {
    const oak = TREE_RECIPE.variants.find((v) => v.id === "oak")!.build(BOX, seededRandom(1));
    expect(oak.filter((p) => p.part === "leaves").every((p) => p.materialId === "cardboard")).toBe(
      true
    );
    expect(oak.filter((p) => p.part === "trunk").every((p) => p.materialId === "earth")).toBe(true);
    const snowy = TREE_RECIPE.variants.find((v) => v.id === "snowy-pine")!;
    expect(snowy.build(BOX, seededRandom(1)).some((p) => p.materialId === "ice")).toBe(true);
  });
});
