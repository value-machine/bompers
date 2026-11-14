import type { Vec2 } from "@/shared/types/gameGeometry.types";
import { resolveCatalogEntry } from "@/features/content-catalog/api/contentCatalogApi";
import type { LevelDefinition, TerrainPiece, TerrainShape } from "@/features/level/api/levelApi";
import type { TerrainGrid } from "@/features/arena/types/arena.types";
import {
  cellRangeOf,
  createTerrainGrid,
  getCellInfo,
  setCellSlot,
  slotFor,
} from "@/features/arena/services/terrainGrid";

/**
 * Builds the terrain grid from a level's terrain shapes (LEVEL_FORMAT.md § 4): a cell is filled
 * when its centre lies inside a shape; polygons use the non-zero rule; where shapes overlap a
 * platform wins over a destructible, and between equal roles the later piece sets the material.
 */
const crossSign = (a: Vec2, b: Vec2, p: Vec2): number =>
  (b.x - a.x) * (p.y - a.y) - (p.x - a.x) * (b.y - a.y);

/** Non-zero winding number test. */
function polygonContains(points: readonly Vec2[], p: Vec2): boolean {
  let winding = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    if (a.y <= p.y && b.y > p.y && crossSign(a, b, p) > 0) winding += 1;
    else if (a.y > p.y && b.y <= p.y && crossSign(a, b, p) < 0) winding -= 1;
  }
  return winding !== 0;
}

/** Point-in-shape test (rect half-open like cells; circle inclusive; polygon non-zero). */
export function shapeContains(shape: TerrainShape, p: Vec2): boolean {
  if (shape.type === "rect") {
    return p.x >= shape.x && p.x < shape.x + shape.w && p.y >= shape.y && p.y < shape.y + shape.h;
  }
  if (shape.type === "circle") {
    const dx = p.x - shape.cx;
    const dy = p.y - shape.cy;
    return dx * dx + dy * dy <= shape.r * shape.r;
  }
  return polygonContains(shape.points, p);
}

function shapeBounds(shape: TerrainShape) {
  if (shape.type === "rect") return { x: shape.x, y: shape.y, w: shape.w, h: shape.h };
  if (shape.type === "circle") {
    return { x: shape.cx - shape.r, y: shape.cy - shape.r, w: shape.r * 2, h: shape.r * 2 };
  }
  const xs = shape.points.map((p) => p.x);
  const ys = shape.points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** The cell slot a piece fills: its role plus the material's behaviour and look. */
function slotOfPiece(grid: TerrainGrid, piece: TerrainPiece): number {
  const { entry } = resolveCatalogEntry("material", piece.materialId);
  if (!entry)
    return slotFor(grid, {
      role: piece.role,
      materialId: piece.materialId,
      destructible: false,
      lookToken: "",
    });
  return slotFor(grid, {
    role: piece.role,
    materialId: entry.id,
    destructible: piece.role === "destructible" && entry.destructible,
    lookToken: entry.lookToken,
  });
}

function rasterizePiece(grid: TerrainGrid, piece: TerrainPiece): void {
  const slot = slotOfPiece(grid, piece);
  const size = grid.cellSize;
  const range = cellRangeOf(grid, shapeBounds(piece.shape));
  for (let cy = range.minY; cy <= range.maxY; cy += 1) {
    for (let cx = range.minX; cx <= range.maxX; cx += 1) {
      if (!shapeContains(piece.shape, { x: (cx + 0.5) * size, y: (cy + 0.5) * size })) continue;
      if (piece.role === "destructible" && getCellInfo(grid, cx, cy)?.role === "platform") continue;
      setCellSlot(grid, { cx, cy, slot });
    }
  }
}

/** Builds the grid a (normalised) level describes. */
export function buildTerrainFromLevel(level: LevelDefinition): TerrainGrid {
  const { cellSize } = level.settings;
  const grid = createTerrainGrid({
    cellSize,
    widthCells: Math.ceil(level.worldSize.w / cellSize),
    heightCells: Math.ceil(level.worldSize.h / cellSize),
  });
  for (const piece of level.terrain) rasterizePiece(grid, piece);
  return grid;
}
