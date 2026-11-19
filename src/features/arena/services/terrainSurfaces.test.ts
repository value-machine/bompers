import { describe, expect, it } from "vitest";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import { buildTerrainFromLevel } from "@/features/arena/services/terrainRaster";
import { burnOut, clearCrater, findSlot } from "@/features/arena/services/terrainGrid";
import { createTerrainView, syncTerrainView } from "@/features/arena/services/terrainRenderer";
import {
  edgeAbove,
  markedRegion,
  slabLips,
  slotLayerBoxes,
  slotLayerRegion,
  terrainContour,
  terrainRings,
  type MaskShapes,
  type OutlineRing,
} from "@/features/arena/services/terrainSurfaces";

// A stone floor and one cardboard part (piece 1), 120 wide.
const level: LevelDefinition = {
  formatVersion: 2,
  meta: { levelId: "m", title: "M" },
  settings: { cellSize: 4, gravity: 1 },
  worldSize: { w: 400, h: 200 },
  terrain: [
    { shape: { type: "rect", x: 50, y: 101, w: 300, h: 60 }, materialId: "earth" },
    { shape: { type: "rect", x: 0, y: 170, w: 400, h: 30 }, materialId: "stone" },
  ],
  spawns: [],
  drops: [],
  collectibles: [],
  bounds: { x: -100, y: -100, w: 600, h: 400 },
};

/** Point-in-polygon (even-odd) for a flat [x, y, …] path. */
function inPiece(piece: readonly number[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = piece.length - 2; i < piece.length; j = i, i += 2) {
    const xi = piece[i]!;
    const yi = piece[i + 1]!;
    const xj = piece[j]!;
    const yj = piece[j + 1]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const covers = (mask: MaskShapes, x: number, y: number): boolean =>
  mask.rects.some((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) ||
  mask.pieces.some((piece) => inPiece(piece, x, y));

const W = 3;
type Grid = ReturnType<typeof buildTerrainFromLevel>;
/** The fill layer of one material's slot (that slot and every later one), as the view draws it. */
const slotFill = (grid: Grid, materialId: string): MaskShapes => {
  const slot = grid.slots.findIndex((s, i) => i > 0 && s.materialId === materialId);
  const region = slotLayerRegion(grid, slot, slotLayerBoxes(grid).get(slot));
  return terrainContour(grid, { grow: 0, region });
};
/** The whole terrain's fill: the first layer (earth is the first slot of `level`). */
const fill = (grid: Grid): MaskShapes => slotFill(grid, "earth");
const outline = (grid: ReturnType<typeof buildTerrainFromLevel>): MaskShapes =>
  terrainContour(grid, { grow: W });

describe("terrainContour", () => {
  it("should trace an untouched slab as itself: fill inside its edge, ink one width outside it", () => {
    const grid = buildTerrainFromLevel(level);
    expect(covers(fill(grid), 200, 101.6)).toBe(true);
    expect(covers(fill(grid), 200, 100.4)).toBe(false);
    expect(covers(outline(grid), 200, 101 - W + 0.6)).toBe(true);
    expect(covers(outline(grid), 200, 101 - W - 0.6)).toBe(false);
    // Rounded corner (radius ≈ 6.2), like the drawn slab: the very corner point is outside.
    expect(covers(fill(grid), 50.3, 101.3)).toBe(false);
  });

  it("should clip along the curved crater rim to within half a unit when a blast cuts the slab", () => {
    const grid = buildTerrainFromLevel(level);
    const centre = { x: 200, y: 101 };
    clearCrater(grid, { ...centre, reach: 34, shape: "round" });
    const mask = fill(grid);
    for (let deg = 20; deg <= 160; deg += 7) {
      const a = (deg * Math.PI) / 180;
      for (const r of [34 - 0.5, 34 + 0.5]) {
        const x = centre.x + Math.cos(a) * r;
        const y = centre.y + Math.sin(a) * r;
        expect(covers(mask, x, y), `${deg}° r ${r}`).toBe(r > 34);
      }
    }
  });

  it("should outline every rim and both cut faces when overlapping craters split the slab", () => {
    const grid = buildTerrainFromLevel(level);
    clearCrater(grid, { x: 150, y: 101, reach: 34, shape: "round" });
    clearCrater(grid, { x: 180, y: 140, reach: 34, shape: "round" });
    const ink = outline(grid);
    expect(covers(ink, 150 + Math.cos(2.4) * 32, 101 + Math.sin(2.4) * 32)).toBe(true);
    expect(covers(ink, 180 - 32, 140)).toBe(true);
    expect(covers(ink, 180 + 32, 140)).toBe(true);
    expect(covers(ink, 180, 140)).toBe(false);
  });

  it("should leave no ink where a platform used to be when blasts remove it completely", () => {
    const grid = buildTerrainFromLevel(level);
    for (let x = 60; x <= 340; x += 40) {
      clearCrater(grid, { x, y: 131, reach: 60, shape: "round" });
    }
    const ink = outline(grid);
    // Nothing of the platform is filled; the stone floor still is.
    expect(covers(fill(grid), 200, 131)).toBe(false);
    expect(covers(fill(grid), 200, 185)).toBe(true);
    // Along the old top, ends and bottom of the platform: no outline left behind.
    for (const [x, y] of [
      [200, 99],
      [48, 130],
      [352, 130],
      [200, 162],
    ] as const) {
      expect(covers(ink, x, y), `${x}, ${y}`).toBe(false);
    }
    // The stone floor below keeps its outline.
    expect(covers(ink, 200, 168)).toBe(true);
  });
});

describe("terrainContour limited to marked samples (a burning or frozen part)", () => {
  type Grid = ReturnType<typeof buildTerrainFromLevel>;
  const centre = (grid: Grid, index: number) => ({
    x: ((index % grid.widthCells) + 0.5) * grid.cellSize,
    y: (Math.floor(index / grid.widthCells) + 0.5) * grid.cellSize,
  });
  /** The earth slab's samples that pass `keep` (the stone floor starts at y 170). */
  const earth = (grid: Grid, keep: (at: { x: number; y: number }) => boolean): number[] =>
    [...grid.cells.keys()].filter((index) => {
      const at = centre(grid, index);
      return grid.cells[index] !== 0 && at.y < 165 && keep(at);
    });
  const part = (grid: Grid, samples: number[], grow = 0): MaskShapes => {
    const region = markedRegion(grid, samples);
    return region ? terrainContour(grid, { grow, region }) : { rects: [], pieces: [] };
  };

  it("should follow the terrain's own edge when the marked part reaches it", () => {
    const grid = buildTerrainFromLevel(level);
    const mask = part(
      grid,
      earth(grid, (at) => at.x < 200)
    );
    expect(covers(mask, 120, 101.6)).toBe(true);
    expect(covers(mask, 120, 100.4)).toBe(false);
    // The slab's rounded corner, as the terrain fill has it.
    expect(covers(mask, 50.3, 101.3)).toBe(false);
  });

  it("should follow the curved crater rim to within half a unit when the marked ground is cut", () => {
    const grid = buildTerrainFromLevel(level);
    const hole = { x: 200, y: 101 };
    clearCrater(grid, { ...hole, reach: 34, shape: "round" });
    const mask = part(
      grid,
      earth(grid, () => true)
    );
    for (let deg = 20; deg <= 160; deg += 7) {
      const a = (deg * Math.PI) / 180;
      for (const r of [34 - 0.5, 34 + 0.5]) {
        const x = hole.x + Math.cos(a) * r;
        const y = hole.y + Math.sin(a) * r;
        expect(covers(mask, x, y), `${deg}° r ${r}`).toBe(r > 34);
      }
    }
  });

  it("should hold every marked sample and no unmarked one when the part ends inside the terrain", () => {
    const grid = buildTerrainFromLevel(level);
    const inPart = (at: { x: number; y: number }) => at.x < 200 + 12 * Math.sin(at.y / 8);
    const samples = earth(grid, inPart);
    const mask = part(grid, samples);
    const marked = new Set(samples);
    for (const index of earth(grid, (at) => at.x > 150 && at.x < 250)) {
      const at = centre(grid, index);
      expect(covers(mask, at.x, at.y), `${at.x}, ${at.y}`).toBe(marked.has(index));
    }
  });

  it("should show a single marked sample when a part has just started", () => {
    const grid = buildTerrainFromLevel(level);
    const [index] = earth(grid, (at) => at.x > 200 && at.y > 130);
    const at = centre(grid, index!);
    const mask = part(grid, [index!]);
    expect(covers(mask, at.x, at.y)).toBe(true);
    expect(covers(mask, at.x + grid.cellSize, at.y)).toBe(false);
  });

  it("should stay inside the terrain's outline when the part is grown for its ink line", () => {
    const grid = buildTerrainFromLevel(level);
    const ink = part(
      grid,
      earth(grid, (at) => at.x < 200),
      W
    );
    expect(covers(ink, 120, 101 - W + 0.6)).toBe(true);
    expect(covers(ink, 120, 101 - W - 0.6)).toBe(false);
  });

  it("should be nothing when no solid sample is marked", () => {
    const grid = buildTerrainFromLevel(level);
    expect(markedRegion(grid, [])).toBeNull();
    expect(markedRegion(grid, [0])).toBeNull();
  });
});

describe("edgeAbove", () => {
  it("should give the slab's top where a sample has air above it and null where it has terrain", () => {
    const grid = buildTerrainFromLevel(level);
    const firstRow = [...Array(grid.heightCells).keys()].find(
      (cy) => grid.cells[cy * grid.widthCells + 50] !== 0
    )!;
    const top = firstRow * grid.widthCells + 50;
    expect(edgeAbove(grid, top)).toBeCloseTo(101, 0);
    expect(edgeAbove(grid, top + grid.widthCells)).toBeNull();
    expect(edgeAbove(grid, top - grid.widthCells)).toBeNull();
  });

  it("should move with the terrain when a blast cuts it", () => {
    const grid = buildTerrainFromLevel(level);
    const before = grid.shapeVersion;
    clearCrater(grid, { x: 200, y: 101, reach: 34, shape: "round" });
    expect(grid.shapeVersion).toBeGreaterThan(before);
    const column = 50;
    const first = [...Array(grid.heightCells).keys()].find(
      (cy) => grid.cells[cy * grid.widthCells + column] !== 0
    )!;
    expect(edgeAbove(grid, first * grid.widthCells + column)).toBeCloseTo(101 + 34, 0);
  });
});

/** Distance from a point to the nearest segment of any ring. */
function ringDistance(rings: readonly OutlineRing[], x: number, y: number): number {
  let best = Infinity;
  for (const { points, closed } of rings) {
    const last = closed ? points.length : points.length - 2;
    for (let i = 0; i < last; i += 2) {
      const ax = points[i]!;
      const ay = points[i + 1]!;
      const bx = points[(i + 2) % points.length]!;
      const by = points[(i + 3) % points.length]!;
      const len = (bx - ax) ** 2 + (by - ay) ** 2;
      const t =
        len > 0 ? Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / len)) : 0;
      best = Math.min(best, Math.hypot(x - ax - (bx - ax) * t, y - ay - (by - ay) * t));
    }
  }
  return best;
}

/** Signed area of a flat [x, y, …] ring (the sign tells its winding). */
function ringArea(points: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i += 2) {
    const j = (i + 2) % points.length;
    sum += points[i]! * points[j + 1]! - points[j]! * points[i + 1]!;
  }
  return sum / 2;
}

describe("terrainRings (outline-system: the terrain's edge as closed lines)", () => {
  it("should trace each untouched slab as one closed ring on its edge", () => {
    const rings = terrainRings(buildTerrainFromLevel(level), { grow: 0 });
    expect(rings).toHaveLength(2);
    expect(rings.every((ring) => ring.closed)).toBe(true);
    // On the slab's top and bottom edges (where the contour's fill ends); nowhere near its middle.
    expect(ringDistance(rings, 200, 101)).toBeLessThan(0.5);
    expect(ringDistance(rings, 200, 161)).toBeLessThan(0.5);
    expect(ringDistance(rings, 200, 131)).toBeGreaterThan(25);
  });

  it("should keep a straight edge as one segment when the slab is a rounded rect", () => {
    const rings = terrainRings(buildTerrainFromLevel(level), { grow: 0 });
    // Four sides plus a few points per rounded corner, not one point per sample.
    for (const ring of rings) expect(ring.points.length / 2).toBeLessThan(40);
  });

  it("should wind a hole against its slab when a crater opens inside the slab", () => {
    const grid = buildTerrainFromLevel(level);
    clearCrater(grid, { x: 200, y: 131, reach: 14, shape: "round" });
    const rings = terrainRings(grid, { grow: 0 });
    expect(rings).toHaveLength(3);
    expect(rings.every((ring) => ring.closed)).toBe(true);
    const signs = rings.map((ring) => Math.sign(ringArea(ring.points)));
    expect(signs.filter((sign) => sign !== signs[0])).toHaveLength(1);
    // The crater's rim (radius 14) carries a line.
    expect(ringDistance(rings, 200 + 14, 131)).toBeLessThan(0.75);
  });

  it("should hold no broken numbers and no repeated points when blasts and burn-outs cut the slab", () => {
    const grid = buildTerrainFromLevel(level);
    for (let x = 70; x <= 330; x += 52) clearCrater(grid, { x, y: 110, reach: 22, shape: "round" });
    burnOut(
      grid,
      [...grid.cells.keys()].filter((index) => grid.cells[index] !== 0 && index % 7 === 0)
    );
    const rings = terrainRings(grid, { grow: 0 });
    expect(rings.length).toBeGreaterThan(0);
    for (const { points, closed } of rings) {
      expect(closed).toBe(true);
      expect(points.every(Number.isFinite)).toBe(true);
      for (let i = 0; i < points.length; i += 2) {
        const j = (i + 2) % points.length;
        expect(
          Math.hypot(points[j]! - points[i]!, points[j + 1]! - points[i + 1]!)
        ).toBeGreaterThan(0.01);
      }
    }
  });
});

describe("terrain ink (outline-system: a line, never a shape under the fill)", () => {
  const actions = (g: { context: { instructions: readonly { action: string }[] } }): string[] =>
    g.context.instructions.map((instruction) => instruction.action);

  it("should draw the terrain's ink as strokes only when the view is synced", () => {
    const terrain = buildTerrainFromLevel(level);
    const view = createTerrainView({ terrain, level });
    syncTerrainView(view, terrain, 1);
    expect(actions(view.ink)).toEqual(["stroke"]);
  });

  it("should draw a moving part's ink as strokes only when the view is synced", () => {
    const terrain = buildTerrainFromLevel(partLevel);
    const view = createTerrainView({ terrain, level: partLevel });
    syncTerrainView(view, terrain, 1);
    expect(actions(view.movers[0]!.ink)).toEqual(["stroke"]);
  });

  it("should restroke the same rings at the new width when only the zoom steps", () => {
    const terrain = buildTerrainFromLevel(level);
    const view = createTerrainView({ terrain, level });
    syncTerrainView(view, terrain, 1);
    const rings = view.rings;
    const before = view.ink.getLocalBounds().width;
    syncTerrainView(view, terrain, 0.5);
    expect(view.rings).toBe(rings);
    expect(view.ink.getLocalBounds().width).toBeGreaterThan(before);
  });
});

const partLevel: LevelDefinition = {
  formatVersion: 2,
  meta: { levelId: "v", title: "V" },
  settings: { cellSize: 4, gravity: 1 },
  worldSize: { w: 600, h: 300 },
  terrain: [
    { shape: { type: "rect", x: 0, y: 200, w: 600, h: 40 }, materialId: "stone" },
    { shape: { type: "rect", x: 240, y: 100, w: 120, h: 40 }, materialId: "cardboard" },
  ],
  movers: [
    {
      motion: { kind: "slide", offset: { x: 0, y: -60 }, periodS: 4, phase: 0 },
      pivot: { x: 300, y: 120 },
      terrainIndices: [1],
    },
  ],
  spawns: [],
  drops: [],
  collectibles: [],
  bounds: { x: 0, y: 0, w: 600, h: 300 },
};

describe("moving part view (mover-materials-l2)", () => {
  it("should redraw a part's outline and fill narrower when half of its field has burnt out", () => {
    const terrain = buildTerrainFromLevel(partLevel);
    const view = createTerrainView({ terrain, level: partLevel });
    syncTerrainView(view, terrain, 1);
    const part = view.movers[0]!;
    const partFill = [...part.slabs.fills.values()][0]!.g;
    const [before, maskBefore] = [part.ink, partFill].map((g) => g.getLocalBounds().width) as [
      number,
      number,
    ];
    expect(before).toBeGreaterThan(120);
    expect(maskBefore).toBeGreaterThan(100);

    const field = terrain.movers[0]!.field;
    const half = Math.floor(field.widthCells / 2);
    const isLeft = (index: number): boolean => index % field.widthCells < half;
    burnOut(
      field,
      [...field.cells.keys()].filter((index) => field.cells[index] !== 0 && isLeft(index))
    );
    syncTerrainView(view, terrain, 1);
    expect(part.ink.getLocalBounds().width).toBeLessThan(before * 0.6);
    expect(partFill.getLocalBounds().width).toBeLessThan(maskBefore * 0.6);
  });
});

// A slab on a pillar on a floor, all stone: one wall (the options page's drawing, x 4).
const wallLevel: LevelDefinition = {
  formatVersion: 2,
  meta: { levelId: "w", title: "W" },
  settings: { cellSize: 4, gravity: 1 },
  worldSize: { w: 640, h: 480 },
  terrain: [
    { shape: { type: "rect", x: 80, y: 40, w: 480, h: 96 }, materialId: "stone" },
    { shape: { type: "rect", x: 240, y: 136, w: 120, h: 224 }, materialId: "stone" },
    { shape: { type: "rect", x: 0, y: 360, w: 640, h: 120 }, materialId: "stone" },
  ],
  spawns: [],
  drops: [],
  collectibles: [],
  bounds: { x: 0, y: 0, w: 640, h: 480 },
};

const lipsAt = (grid: Grid, lvl: LevelDefinition, y: number) => {
  const pieces = lvl.terrain.map((piece) => ({
    shape: piece.shape,
    swatch: { fill: 1, lip: 2, seam: 3 },
    surface: "plain" as const,
    slot: findSlot(grid, {
      materialId: piece.materialId,
      colorId: grid.slots.find((s) => s.materialId === piece.materialId)?.colorId ?? "",
    }),
  }));
  return slabLips(grid, pieces)
    .filter((lip) => Math.abs(lip.y - y) < 4)
    .sort((a, b) => a.x - b.x);
};

describe("slab fills from the field (outline-system D6: touching shapes are one)", () => {
  it("should fill the inner corners where a pillar meets a slab when both are one colour", () => {
    const grid = buildTerrainFromLevel(wallLevel);
    const wall = slotFill(grid, "stone");
    // Just inside each of the four inner corners: the rounded slab fills left these open.
    for (const [x, y] of [
      [241, 137],
      [359, 137],
      [241, 359],
      [359, 359],
    ] as const) {
      expect(covers(wall, x, y), `${x}, ${y}`).toBe(true);
    }
    // The wall's edges are still its edges.
    expect(covers(wall, 200, 200)).toBe(false);
    expect(covers(wall, 300, 200)).toBe(true);
  });

  it("should leave no gap between two colours when their slabs touch near the top edge", () => {
    const grid = buildTerrainFromLevel(level);
    const twoTone: LevelDefinition = {
      ...level,
      terrain: [
        { shape: { type: "rect", x: 40, y: 80, w: 160, h: 80 }, materialId: "earth" },
        { shape: { type: "rect", x: 200, y: 80, w: 160, h: 80 }, materialId: "stone" },
      ],
    };
    const two = buildTerrainFromLevel(twoTone);
    const base = slotFill(two, "earth");
    const stone = slotFill(two, "stone");
    // The first layer is the whole terrain: no point at the seam is left open.
    for (let x = 194; x <= 206; x += 0.5) {
      for (const y of [81, 83, 100, 158]) expect(covers(base, x, y), `${x}, ${y}`).toBe(true);
    }
    // The later colour is painted over it up to the line between the two slabs.
    expect(covers(stone, 197, 100)).toBe(false);
    expect(covers(stone, 203, 100)).toBe(true);
    expect(grid.slots.length).toBeGreaterThan(1);
  });

  it("should cut a slot's fill along the crater rim when a blast opens it", () => {
    const grid = buildTerrainFromLevel(level);
    clearCrater(grid, { x: 200, y: 101, reach: 30, shape: "round" });
    expect(covers(fill(grid), 200, 110)).toBe(false);
    expect(covers(fill(grid), 200, 150)).toBe(true);
  });
});

describe("slabLips (owner pick: lips on open tops)", () => {
  it("should give the top slab one lip set in from both ends when nothing sits on it", () => {
    const grid = buildTerrainFromLevel(wallLevel);
    const lips = lipsAt(grid, wallLevel, 40);
    expect(lips).toHaveLength(1);
    expect(lips[0]!.x).toBeGreaterThan(80 + 1.5);
    expect(lips[0]!.x).toBeLessThan(80 + 5);
    expect(lips[0]!.x + lips[0]!.w).toBeGreaterThan(560 - 5);
    expect(lips[0]!.x + lips[0]!.w).toBeLessThan(560 - 1.5);
  });

  it("should give the pillar no lip when a slab sits on top of it", () => {
    const grid = buildTerrainFromLevel(wallLevel);
    expect(lipsAt(grid, wallLevel, 136)).toHaveLength(0);
  });

  it("should give the floor a lip on each side of the pillar, set in from the pillar's walls", () => {
    const grid = buildTerrainFromLevel(wallLevel);
    const lips = lipsAt(grid, wallLevel, 360);
    expect(lips).toHaveLength(2);
    expect(lips[0]!.x + lips[0]!.w).toBeLessThan(240 - 1.5);
    expect(lips[0]!.x + lips[0]!.w).toBeGreaterThan(240 - 5);
    expect(lips[1]!.x).toBeGreaterThan(360 + 1.5);
    expect(lips[1]!.x).toBeLessThan(360 + 5);
  });

  it("should run one lip across two slabs when they stand side by side at one height", () => {
    const sideBySide: LevelDefinition = {
      ...wallLevel,
      terrain: [
        { shape: { type: "rect", x: 80, y: 200, w: 200, h: 80 }, materialId: "stone" },
        { shape: { type: "rect", x: 280, y: 200, w: 200, h: 80 }, materialId: "stone" },
      ],
    };
    const lips = lipsAt(buildTerrainFromLevel(sideBySide), sideBySide, 200);
    expect(lips).toHaveLength(1);
    expect(lips[0]!.w).toBeGreaterThan(380);
  });

  it("should split the lip around a crater when a blast takes the top edge", () => {
    const grid = buildTerrainFromLevel(level);
    expect(lipsAt(grid, level, 101)).toHaveLength(1);
    clearCrater(grid, { x: 200, y: 101, reach: 30, shape: "round" });
    const lips = lipsAt(grid, level, 101);
    expect(lips).toHaveLength(2);
    expect(lips[0]!.x + lips[0]!.w).toBeLessThan(200 - 30);
    expect(lips[1]!.x).toBeGreaterThan(200 + 30);
  });
});

describe("terrain view without a clip mask (outline-system D6)", () => {
  it("should draw no masked layer when the view holds breakable terrain and a part", () => {
    const terrain = buildTerrainFromLevel(partLevel);
    const view = createTerrainView({ terrain, level: partLevel });
    syncTerrainView(view, terrain, 1);
    const masked: string[] = [];
    const walk = (node: { label: string; mask?: unknown; children?: unknown[] }): void => {
      if (node.mask) masked.push(node.label);
      for (const child of node.children ?? []) walk(child as typeof node);
    };
    walk(view.container as never);
    expect(masked).toEqual([]);
  });

  it("should redraw only the fills near the change when a blast cuts one slab", () => {
    const far: LevelDefinition = {
      ...wallLevel,
      terrain: [
        { shape: { type: "rect", x: 16, y: 40, w: 80, h: 40 }, materialId: "earth" },
        { shape: { type: "rect", x: 480, y: 400, w: 120, h: 40 }, materialId: "stone" },
      ],
    };
    const grid = buildTerrainFromLevel(far);
    const view = createTerrainView({ terrain: grid, level: far });
    syncTerrainView(view, grid, 1);
    const stone = [...view.slabs.fills.values()].find((layer) => layer.box.minY > 50)!;
    expect(stone.g.context.instructions.length).toBeGreaterThan(0);
    // Emptied by hand: a redraw would fill it again.
    stone.g.context.instructions.length = 0;
    clearCrater(grid, { x: 56, y: 40, reach: 20, shape: "round" });
    syncTerrainView(view, grid, 1);
    expect(stone.g.context.instructions.length).toBe(0);
  });
});
