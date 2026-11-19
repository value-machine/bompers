import { describe, expect, it } from "vitest";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import { clearCraterOnBodies } from "@/features/arena/services/terrainBodies";
import { buildTerrainFromLevel } from "@/features/arena/services/terrainRaster";
import { resolveCatalogEntry } from "@/features/content-catalog/api/contentCatalogApi";
import {
  burnOut,
  clearCrater,
  createTerrainGrid,
  getCellInfo,
  groundFrictionBelow,
  isSolidAt,
  rectHitsSolid,
  sampleDistance,
  setSampleFrozen,
  surfaceBelow,
  takeDirtyChunks,
} from "@/features/arena/services/terrainGrid";

const level: LevelDefinition = {
  formatVersion: 1,
  meta: { levelId: "t", title: "T" },
  settings: { cellSize: 10, gravity: 1 },
  worldSize: { w: 400, h: 200 },
  terrain: [
    {
      shape: { type: "rect", x: 0, y: 100, w: 400, h: 20 },

      materialId: "earth",
    },
    { shape: { type: "rect", x: 0, y: 120, w: 400, h: 20 }, materialId: "stone" },
  ],
  spawns: [],
  drops: [],
  collectibles: [],
  bounds: { x: -100, y: -100, w: 600, h: 400 },
};

describe("terrainGrid", () => {
  it("should read cells outside the grid as empty", () => {
    const grid = buildTerrainFromLevel(level);
    expect(getCellInfo(grid, -1, 11)).toBeNull();
    expect(isSolidAt(grid, 9999, 115)).toBe(false);
  });

  it("should report a rect that overlaps terrain but not one that only touches its top", () => {
    const grid = buildTerrainFromLevel(level);
    expect(rectHitsSolid(grid, { x: 20, y: 80, w: 10, h: 20 })).toBe(false);
    expect(rectHitsSolid(grid, { x: 20, y: 80, w: 10, h: 21 })).toBe(true);
  });

  it("should remove breakable cells but keep unbreakable cells when a circle is blasted", () => {
    const grid = buildTerrainFromLevel(level);
    const cleared = clearCrater(grid, { x: 200, y: 115, shape: "round", reach: 25 });
    expect(cleared.removed).toBeGreaterThan(0);
    expect(cleared.byLook).toEqual([
      { materialId: "earth", colorId: "clay", cells: cleared.removed },
    ]);
    expect(getCellInfo(grid, 20, 11)).toBeNull();
    expect(getCellInfo(grid, 20, 12)?.materialId).toBe("stone");
  });

  it("should keep ice cells whatever their colour when a circle is blasted", () => {
    const grid = buildTerrainFromLevel({
      ...level,
      terrain: [
        { shape: { type: "rect", x: 0, y: 100, w: 40, h: 10 }, materialId: "ice", colorId: "clay" },
      ],
    });
    expect(clearCrater(grid, { x: 20, y: 105, shape: "round", reach: 30 }).removed).toBe(0);
  });

  it("should report each colour of a material separately when a blast clears both", () => {
    const grid = buildTerrainFromLevel({
      ...level,
      terrain: [
        {
          shape: { type: "rect", x: 0, y: 100, w: 20, h: 10 },
          materialId: "earth",
          colorId: "rose",
        },
        {
          shape: { type: "rect", x: 20, y: 100, w: 20, h: 10 },
          materialId: "earth",
          colorId: "mint",
        },
      ],
    });
    const cleared = clearCrater(grid, { x: 20, y: 105, shape: "round", reach: 30 });
    expect(cleared.byLook).toEqual([
      { materialId: "earth", colorId: "rose", cells: 2 },
      { materialId: "earth", colorId: "mint", cells: 2 },
    ]);
  });

  it("should read low friction under the feet when standing on ice", () => {
    const grid = buildTerrainFromLevel({
      ...level,
      terrain: [
        { shape: { type: "rect", x: 0, y: 100, w: 200, h: 10 }, materialId: "ice" },
        { shape: { type: "rect", x: 200, y: 100, w: 200, h: 10 }, materialId: "stone" },
      ],
    });
    const iceFriction = resolveCatalogEntry("material", "ice").entry?.friction;
    expect(iceFriction).toBeLessThan(1);
    expect(groundFrictionBelow(grid, { x: 40, y: 100, w: 20 })).toBeCloseTo(iceFriction!);
    expect(groundFrictionBelow(grid, { x: 240, y: 100, w: 20 })).toBe(1);
    expect(groundFrictionBelow(grid, { x: 40, y: 60, w: 20 })).toBe(1);
  });

  it("should read the ice under the feet when the ice top lies between sample rows", () => {
    // Top at y 100 on 8-unit samples: the row holding y 100 (96–104) has no solid centre, so
    // feet resting there must read the row below (the slopes, curves and round frozen craters case).
    const grid = buildTerrainFromLevel({
      ...level,
      settings: { cellSize: 8, gravity: 1 },
      terrain: [{ shape: { type: "rect", x: 0, y: 100, w: 200, h: 20 }, materialId: "ice" }],
    });
    const iceFriction = resolveCatalogEntry("material", "ice").entry?.friction;
    expect(groundFrictionBelow(grid, { x: 40, y: 100, w: 20 })).toBeCloseTo(iceFriction!);
    expect(groundFrictionBelow(grid, { x: 40, y: 103, w: 20 })).toBeCloseTo(iceFriction!);
  });

  it("should mark only the touched chunks dirty when a circle is blasted", () => {
    const grid = buildTerrainFromLevel(level);
    takeDirtyChunks(grid);
    clearCrater(grid, { x: 15, y: 105, shape: "round", reach: 6 });
    // Chunk 0 holds the crater; chunk 3 (below it) holds air within the field band (5 samples,
    // slope-walking A5) that the blast re-measures. The far chunks stay clean.
    expect(takeDirtyChunks(grid)).toEqual([0, 3]);
    expect(grid.dirtyChunks.size).toBe(0);
  });

  it("should start with every chunk dirty so the first render draws everything", () => {
    const grid = createTerrainGrid({ cellSize: 8, widthCells: 33, heightCells: 16 });
    expect(takeDirtyChunks(grid)).toEqual([0, 1, 2]);
  });

  it("should find the top of the first surface under a span when it is within range", () => {
    const grid = buildTerrainFromLevel(level);
    expect(surfaceBelow(grid, { x: 20, y: 40, w: 10, range: 240 })).toBe(100);
    expect(surfaceBelow(grid, { x: 20, y: 40, w: 10, range: 30 })).toBeNull();
    expect(surfaceBelow(grid, { x: 900, y: 40, w: 10, range: 240 })).toBeNull();
  });
});

describe("clearCrater toughness", () => {
  it("should cut a wider crater in soft cardboard than in earth and none in stone when the reach is the same", () => {
    const grid = buildTerrainFromLevel({
      ...level,
      settings: { cellSize: 2, gravity: 1 },
      terrain: [
        { shape: { type: "rect", x: 0, y: 100, w: 400, h: 100 }, materialId: "cardboard" },
        { shape: { type: "rect", x: 400, y: 100, w: 400, h: 100 }, materialId: "earth" },
        { shape: { type: "rect", x: 800, y: 100, w: 400, h: 100 }, materialId: "stone" },
      ],
      worldSize: { w: 1200, h: 200 },
    });
    // Rocket at power 50: crater reach 34 at toughness 1; cardboard (0.7) opens to 34 / 0.7 ≈ 48.6.
    const widthAt = (x: number): number => {
      clearCrater(grid, { x, y: 100, shape: "round", reach: 34 });
      let cleared = 0;
      for (let cx = Math.floor((x - 60) / 2); cx <= Math.floor((x + 60) / 2); cx += 1) {
        if (getCellInfo(grid, cx, 50) === null) cleared += 1;
      }
      return cleared * 2;
    };
    const cardboard = widthAt(200);
    const earth = widthAt(600);
    expect(cardboard).toBeGreaterThanOrEqual(94);
    expect(cardboard).toBeLessThanOrEqual(98);
    expect(earth).toBeGreaterThanOrEqual(66);
    expect(earth).toBeLessThanOrEqual(70);
    expect(widthAt(1000)).toBe(0);
  });
});

const S = 4;
const fieldLevel: LevelDefinition = {
  ...level,
  settings: { cellSize: S, gravity: 1 },
  worldSize: { w: 600, h: 200 },
  terrain: [
    { shape: { type: "rect", x: 0, y: 100, w: 200, h: 100 }, materialId: "cardboard" },
    { shape: { type: "rect", x: 200, y: 100, w: 200, h: 100 }, materialId: "earth" },
    { shape: { type: "rect", x: 400, y: 100, w: 200, h: 60 }, materialId: "stone" },
  ],
};

/** Distance at the centre of the sample under world point (x, y). */
const at = (grid: ReturnType<typeof buildTerrainFromLevel>, x: number, y: number): number =>
  sampleDistance(grid, Math.floor(x / S), Math.floor(y / S));

describe("terrain distance field", () => {
  it("should seed each sample with its distance to the nearest terrain edge when a level loads", () => {
    const grid = buildTerrainFromLevel(fieldLevel);
    // Sample centre (102, 106): 6 below the top edge.
    expect(at(grid, 102, 106)).toBeCloseTo(6);
    // Sample centre (102, 94): 6 above the top edge, outside.
    expect(at(grid, 102, 94)).toBeCloseTo(-6);
    // Deep inside: clamped to the band, still positive.
    expect(at(grid, 102, 150)).toBeGreaterThan(8);
  });

  it("should not read a seam between two touching shapes as a surface when the inside is solid both ways", () => {
    const grid = buildTerrainFromLevel(fieldLevel);
    // Sample centre (198, 150): 2 from the cardboard / earth seam, 50 from any real edge.
    expect(at(grid, 198, 150)).toBeGreaterThan(8);
  });

  it("should mark unbreakable samples and the bottom row anchored but not floating breakable ones", () => {
    const grid = buildTerrainFromLevel(fieldLevel);
    const anchored = (x: number, y: number): number =>
      grid.anchored[Math.floor(y / S) * grid.widthCells + Math.floor(x / S)] ?? 0;
    expect(anchored(450, 120)).toBe(1);
    expect(anchored(100, 198)).toBe(1);
    expect(anchored(100, 120)).toBe(0);
  });

  it("should put the crater rim on the curve reach ÷ toughness and keep a sample solid only while its distance is positive", () => {
    const grid = buildTerrainFromLevel(fieldLevel);
    const earth = clearCrater(grid, { x: 300, y: 100, reach: 34, shape: "round" });
    const card = clearCrater(grid, { x: 100, y: 100, reach: 34, shape: "round" });
    // Earth (toughness 1): rim at 34 from the centre; cardboard (0.7): at 34 / 0.7 ≈ 48.6.
    expect(at(grid, 302, 130)).toBeCloseTo(Math.hypot(0, 30) - 34, 0);
    expect(at(grid, 302, 142)).toBeCloseTo(Math.hypot(0, 42) - 34, 0);
    expect(at(grid, 102, 142)).toBeCloseTo(42 - 34 / 0.7, 0);
    for (const [x, y] of [
      [302, 130],
      [302, 142],
      [102, 142],
      [102, 154],
    ] as const) {
      const solid = getCellInfo(grid, Math.floor(x / S), Math.floor(y / S)) !== null;
      expect(solid).toBe(at(grid, x, y) > 0);
    }
    // The touched box covers every cleared earth sample (x 266–334, y 100–134).
    expect(earth.box.minX).toBeLessThanOrEqual(66);
    expect(earth.box.maxX).toBeGreaterThanOrEqual(83);
    expect(earth.box.minY).toBeLessThanOrEqual(25);
    expect(earth.box.maxY).toBeGreaterThanOrEqual(33);
    expect(card.removed).toBeGreaterThan(earth.removed);
  });

  it("should leave unbreakable samples and their distance untouched when a blast hits them", () => {
    const grid = buildTerrainFromLevel(fieldLevel);
    const before = at(grid, 502, 106);
    expect(clearCrater(grid, { x: 500, y: 100, reach: 34, shape: "round" }).removed).toBe(0);
    expect(at(grid, 502, 106)).toBe(before);
  });
});

describe("terrainGrid — burnOut (fire-spread b1)", () => {
  it("should empty burnt-out samples and give their solid neighbours an edge when they burn out", () => {
    const grid = buildTerrainFromLevel(level);
    // Earth row cy 10 (y 100–110): burn out cx 10–12, leaving cx 13 as the new side.
    const indices = [10, 11, 12].map((cx) => 10 * grid.widthCells + cx);
    const cleared = burnOut(grid, indices);
    expect(cleared.removed).toBe(3);
    expect(cleared.byLook[0]?.materialId).toBe("earth");
    for (const cx of [10, 11, 12]) expect(getCellInfo(grid, cx, 10)).toBeNull();
    // The neighbour is still solid and now within one sample of the edge.
    expect(sampleDistance(grid, 13, 10)).toBeGreaterThan(0);
    expect(sampleDistance(grid, 13, 10)).toBeLessThanOrEqual(grid.cellSize);
  });

  it("should skip samples that are already empty when a blast got there first", () => {
    const grid = buildTerrainFromLevel(level);
    const index = 10 * grid.widthCells + 20;
    expect(burnOut(grid, [index]).removed).toBe(1);
    expect(burnOut(grid, [index]).removed).toBe(0);
  });
});

// The bodies module shares this file: arena/services is at its file budget.
describe("clearCraterOnBodies (mover-materials-l4 D1: blasts break moving parts like terrain)", () => {
  /** An earth floor at y 160 and one moving part (piece 1): a 120 × 40 slab at x 140–260, y 60–100. */
  const scene = (materialId: string) =>
    buildTerrainFromLevel({
      formatVersion: 2,
      meta: { levelId: "b", title: "B" },
      settings: { cellSize: 4, gravity: 1 },
      worldSize: { w: 400, h: 200 },
      terrain: [
        { shape: { type: "rect", x: 0, y: 160, w: 400, h: 40 }, materialId: "earth" },
        { shape: { type: "rect", x: 140, y: 60, w: 120, h: 40 }, materialId },
      ],
      movers: [
        {
          motion: { kind: "slide", offset: { x: 0, y: -40 }, periodS: 4, phase: 0 },
          pivot: { x: 200, y: 80 },
          terrainIndices: [1],
        },
      ],
      spawns: [],
      drops: [],
      collectibles: [],
      bounds: { x: 0, y: 0, w: 400, h: 200 },
    });
  const blast = { reach: 20, shape: "round" as const };

  it("should cut a cardboard part where the part is this step and leave the ground far below whole", () => {
    const grid = scene("cardboard");
    // The part has moved up 40: its middle is at y 40 now.
    grid.movers[0]!.pose = { dx: 0, dy: -40, angle: 0 };
    expect(isSolidAt(grid, 200, 40)).toBe(true);
    const cleared = clearCraterOnBodies(grid, { x: 200, y: 40, ...blast });
    expect(isSolidAt(grid, 200, 40)).toBe(false);
    // Softer than earth: the hole is wider than the blast's reach at toughness 1.
    expect(isSolidAt(grid, 224, 40)).toBe(false);
    expect(isSolidAt(grid, 250, 40)).toBe(true);
    expect(cleared.byLook.map((look) => look.materialId)).toEqual(["cardboard"]);
    expect(isSolidAt(grid, 200, 170)).toBe(true);
  });

  it("should leave a stone part whole", () => {
    const grid = scene("stone");
    expect(clearCraterOnBodies(grid, { x: 200, y: 80, ...blast }).removed).toBe(0);
    expect(isSolidAt(grid, 200, 80)).toBe(true);
  });

  it("should cut a turned part at the place the blast hits in the world", () => {
    const grid = scene("cardboard");
    // A quarter turn about the pivot: the slab now stands upright, x 180–220, y 20–140.
    grid.movers[0]!.pose = { dx: 0, dy: 0, angle: Math.PI / 2 };
    expect(isSolidAt(grid, 200, 30)).toBe(true);
    clearCraterOnBodies(grid, { x: 200, y: 30, ...blast });
    expect(isSolidAt(grid, 200, 30)).toBe(false);
    expect(isSolidAt(grid, 200, 120)).toBe(true);
  });

  it("should pool what one blast removes from the ground and from a part", () => {
    const grid = scene("cardboard");
    // The part has moved down onto the floor's height: one blast reaches both.
    grid.movers[0]!.pose = { dx: 0, dy: 56, angle: 0 };
    const cleared = clearCraterOnBodies(grid, { x: 200, y: 158, ...blast });
    expect(cleared.byLook.map((look) => look.materialId).sort()).toEqual(["cardboard", "earth"]);
    expect(cleared.removed).toBe(cleared.byLook.reduce((sum, look) => sum + look.cells, 0));
  });

  it("should leave a frozen part whole, as frozen ground", () => {
    const grid = scene("cardboard");
    const field = grid.movers[0]!.field;
    field.cells.forEach((slot, index) => {
      if (slot !== 0) setSampleFrozen(field, index, true);
    });
    expect(clearCraterOnBodies(grid, { x: 200, y: 80, ...blast }).removed).toBe(0);
  });
});
