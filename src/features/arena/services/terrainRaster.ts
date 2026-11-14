import type { Vec2 } from "@/shared/types/gameGeometry.types";
import { resolveCatalogEntry } from "@/features/content-catalog/api/contentCatalogApi";
import type { LevelDefinition, TerrainPiece, TerrainShape } from "@/features/level/api/levelApi";
import type { TerrainGrid } from "@/features/arena/types/arena.types";
import {
  cellRangeOf,
  createTerrainGrid,
  setCellSlot,
  slotFor,
} from "@/features/arena/services/terrainGrid";

/**
 * Builds the terrain grid from a level's terrain shapes: a cell is filled when its centre lies
 * inside a shape (level file contract). Pieces apply in order, later ones overwrite.
 */
function polygonContains(points: readonly Vec2[], p: Vec2): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const a = points[i]!;
    const b = points[j]!;
    const crosses =
      a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

/** Even-odd point-in-shape test. */
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

function rasterizePiece(grid: TerrainGrid, piece: TerrainPiece): void {
  const material = resolveCatalogEntry("material", piece.materialId).entry;
  const slot = slotFor(grid, {
    materialId: material?.id ?? piece.materialId,
    destructible: piece.role === "destructible" && material?.destructible === true,
    lookToken: material?.lookToken ?? "",
  });
  const size = grid.cellSize;
  const range = cellRangeOf(grid, shapeBounds(piece.shape));
  for (let cy = range.minY; cy <= range.maxY; cy += 1) {
    for (let cx = range.minX; cx <= range.maxX; cx += 1) {
      if (shapeContains(piece.shape, { x: (cx + 0.5) * size, y: (cy + 0.5) * size })) {
        setCellSlot(grid, { cx, cy, slot });
      }
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
