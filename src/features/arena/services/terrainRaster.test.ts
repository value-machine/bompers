import { describe, expect, it } from "vitest";
import type { LevelDefinition, TerrainPiece } from "@/features/level/api/levelApi";
import { buildTerrainFromLevel } from "@/features/arena/services/terrainRaster";
import { getCellInfo } from "@/features/arena/services/terrainGrid";

const levelWith = (terrain: TerrainPiece[]): LevelDefinition => ({
  formatVersion: 1,
  meta: { levelId: "t", title: "T" },
  settings: { cellSize: 10, gravity: 1 },
  worldSize: { w: 100, h: 100 },
  terrain,
  spawns: [],
  drops: [],
  collectibles: [],
  bounds: { x: 0, y: 0, w: 100, h: 100 },
});

const filled = (level: LevelDefinition): string[] => {
  const grid = buildTerrainFromLevel(level);
  const rows: string[] = [];
  for (let cy = 0; cy < grid.heightCells; cy += 1) {
    let row = "";
    for (let cx = 0; cx < grid.widthCells; cx += 1) row += getCellInfo(grid, cx, cy) ? "#" : ".";
    rows.push(row);
  }
  return rows;
};

describe("terrainRaster", () => {
  it("should fill the cells whose centre is inside a rect", () => {
    const rows = filled(
      levelWith([
        {
          shape: { type: "rect", x: 10, y: 20, w: 30, h: 10 },
          role: "platform",
          materialId: "stone",
        },
      ])
    );
    expect(rows[2]).toBe(".###......");
    expect(rows[1]).toBe("..........");
  });

  it("should fill a circle by cell centres", () => {
    const rows = filled(
      levelWith([
        { shape: { type: "circle", cx: 50, cy: 50, r: 10 }, role: "platform", materialId: "stone" },
      ])
    );
    expect(rows[4]).toBe("....##....");
    expect(rows[5]).toBe("....##....");
    expect(rows[3]).toBe("..........");
  });

  it("should fill a polygon by cell centres", () => {
    const triangle = {
      type: "polygon" as const,
      points: [
        { x: 0, y: 100 },
        { x: 100, y: 100 },
        { x: 0, y: 0 },
      ],
    };
    const rows = filled(levelWith([{ shape: triangle, role: "platform", materialId: "stone" }]));
    expect(rows[0]).toBe("..........");
    // Cell 9 sits exactly on the hypotenuse (centre 95,95): on the edge is not inside.
    expect(rows[9]).toBe("#########.");
    expect(rows[5]).toBe("#####.....");
  });

  it("should keep platform cells when a later destructible piece overlaps them", () => {
    const grid = buildTerrainFromLevel(
      levelWith([
        {
          shape: { type: "rect", x: 0, y: 0, w: 20, h: 10 },
          role: "platform",
          materialId: "stone",
        },
        {
          shape: { type: "rect", x: 0, y: 0, w: 100, h: 10 },
          role: "destructible",
          materialId: "dirt",
        },
      ])
    );
    expect(getCellInfo(grid, 0, 0)).toMatchObject({ materialId: "stone", destructible: false });
    expect(getCellInfo(grid, 5, 0)).toMatchObject({
      materialId: "dirt",
      destructible: true,
      lookToken: "dirt",
    });
  });

  it("should let the later piece set the material when two pieces share a role", () => {
    const grid = buildTerrainFromLevel(
      levelWith([
        {
          shape: { type: "rect", x: 0, y: 0, w: 100, h: 10 },
          role: "destructible",
          materialId: "dirt",
        },
        {
          shape: { type: "rect", x: 0, y: 0, w: 20, h: 10 },
          role: "destructible",
          materialId: "stone",
        },
      ])
    );
    expect(getCellInfo(grid, 0, 0)).toMatchObject({ materialId: "stone", destructible: false });
  });

  it("should fill a self-overlapping polygon's overlap by the non-zero rule", () => {
    // One outline tracing two clockwise boxes that overlap at x 40–60: winding 2 there, still filled.
    const points = [
      { x: 0, y: 40 },
      { x: 60, y: 40 },
      { x: 60, y: 60 },
      { x: 0, y: 60 },
      { x: 0, y: 40 },
      { x: 40, y: 40 },
      { x: 100, y: 40 },
      { x: 100, y: 60 },
      { x: 40, y: 60 },
      { x: 40, y: 40 },
    ];
    const rows = filled(
      levelWith([{ shape: { type: "polygon", points }, role: "platform", materialId: "stone" }])
    );
    expect(rows[4]).toBe("##########");
  });
});
