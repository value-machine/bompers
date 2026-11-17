import { shapeSignedDistance } from "@/shared/utils/shapeGeometry";
import { resolveCatalogEntry } from "@/features/content-catalog/api/contentCatalogApi";
import type { LevelDefinition, TerrainPiece, TerrainShape } from "@/features/level/api/levelApi";
import {
  EMPTY_CELL,
  type TerrainCellSlot,
  type TerrainGrid,
} from "@/features/arena/types/arena.types";
import {
  EDGE_EPSILON,
  HALF_DIAGONAL,
  cellRangeOf,
  createTerrainGrid,
  fieldBand,
  getCellInfo,
  isBreakableSlot,
  nearestEmptyDistance,
  slotFor,
  writeSample,
} from "@/features/arena/services/terrainGrid";
import { SLAB_CORNER_RADIUS } from "@/features/arena/services/terrainSurfaces";

/**
 * Builds the terrain grid from a level's terrain shapes (LEVEL_FORMAT.md § 4): a cell is filled
 * when its centre lies inside a shape (rect slabs with their drawn rounded corners); polygons use
 * the non-zero rule; where shapes overlap an unbreakable material wins over a breakable one, and
 * between equals the later piece wins.
 */
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

const UNKNOWN_MATERIAL = {
  id: "",
  defaultColor: "",
  toughness: null,
  friction: 1,
  surface: "plain",
} as const;

/** What a piece fills: the material's behaviour (catalog) plus the piece's colour. */
export function pieceCellSlot(piece: TerrainPiece): TerrainCellSlot {
  // Unknown IDs resolve to the fallback material (stone); the normaliser already warned.
  const entry = resolveCatalogEntry("material", piece.materialId).entry ?? UNKNOWN_MATERIAL;
  return {
    materialId: entry.id,
    colorId: piece.colorId ?? entry.defaultColor,
    toughness: entry.toughness,
    friction: entry.friction,
    surface: entry.surface,
  };
}

/** The cell slot a piece fills. */
const slotOfPiece = (grid: TerrainGrid, piece: TerrainPiece): number =>
  slotFor(grid, pieceCellSlot(piece));

/**
 * Fills the samples whose centre lies in the piece (material by the overlap rule) and raises the
 * seed distance of every sample within the band to the piece's signed distance (union = max,
 * terrain-field D3).
 */
interface PieceRaster {
  grid: TerrainGrid;
  shape: TerrainShape;
  slot: number;
  breakable: boolean;
  seed: Float32Array;
}

/** One sample of a piece: raise its seed distance and fill it when its centre is inside. */
function rasterizeSample(raster: PieceRaster, cx: number, cy: number): void {
  const { grid, seed } = raster;
  const size = grid.cellSize;
  const centre = { x: (cx + 0.5) * size, y: (cy + 0.5) * size };
  const index = cy * grid.widthCells + cx;
  // The field follows the slab as drawn (rounded rect corners), and solidity follows the field,
  // so collision, fill and outline share one shape (terrain-curves D8).
  const distance = shapeSignedDistance(raster.shape, centre, SLAB_CORNER_RADIUS);
  seed[index] = Math.max(seed[index] ?? -fieldBand(grid), distance);
  if (distance <= 0) return;
  // An unbreakable cell is never overwritten by a breakable piece (LEVEL_FORMAT § 4).
  const below = getCellInfo(grid, cx, cy);
  if (raster.breakable && below !== null && !isBreakableSlot(below)) return;
  writeSample(grid, { cx, cy, slot: raster.slot });
}

function rasterizePiece(grid: TerrainGrid, piece: TerrainPiece, seed: Float32Array): void {
  const slot = slotOfPiece(grid, piece);
  const raster = {
    grid,
    shape: piece.shape,
    slot,
    breakable: isBreakableSlot(grid.slots[slot]),
    seed,
  };
  const band = fieldBand(grid);
  const bounds = shapeBounds(piece.shape);
  const range = cellRangeOf(grid, {
    x: bounds.x - band,
    y: bounds.y - band,
    w: bounds.w + band * 2,
    h: bounds.h + band * 2,
  });
  for (
    let cy = Math.max(0, range.minY);
    cy <= Math.min(grid.heightCells - 1, range.maxY);
    cy += 1
  ) {
    for (
      let cx = Math.max(0, range.minX);
      cx <= Math.min(grid.widthCells - 1, range.maxX);
      cx += 1
    ) {
      rasterizeSample(raster, cx, cy);
    }
  }
}

/**
 * Final distance of one sample: outside, the shapes' union distance; inside, at least the bound
 * from the nearest empty sample, so a seam between two touching shapes is not read as an edge.
 * Clamped to the band, with the sign the slot says (solid ⇔ distance > 0). Also sets anchored.
 */
function finishSample(grid: TerrainGrid, seed: Float32Array, at: { cx: number; cy: number }): void {
  const { cx, cy } = at;
  const index = cy * grid.widthCells + cx;
  const band = fieldBand(grid);
  const slot = grid.cells[index] ?? EMPTY_CELL;
  const shaped = seed[index] ?? -band;
  if (slot === EMPTY_CELL) {
    writeSample(grid, { cx, cy, slot, distance: Math.max(-band, Math.min(shaped, -EDGE_EPSILON)) });
    return;
  }
  const inner =
    shaped >= band
      ? band
      : Math.max(shaped, nearestEmptyDistance(grid, cx, cy) - HALF_DIAGONAL * grid.cellSize);
  writeSample(grid, { cx, cy, slot, distance: Math.min(band, Math.max(EDGE_EPSILON, inner)) });
  const unbreakable = !isBreakableSlot(grid.slots[slot]);
  if (unbreakable || cy === grid.heightCells - 1) grid.anchored[index] = 1;
}

/** Builds the grid a (normalised) level describes: material slots plus the distance field. */
export function buildTerrainFromLevel(level: LevelDefinition): TerrainGrid {
  const { cellSize } = level.settings;
  const grid = createTerrainGrid({
    cellSize,
    widthCells: Math.ceil(level.worldSize.w / cellSize),
    heightCells: Math.ceil(level.worldSize.h / cellSize),
  });
  const seed = new Float32Array(grid.cells.length).fill(-fieldBand(grid));
  for (const piece of level.terrain) rasterizePiece(grid, piece, seed);
  for (let cy = 0; cy < grid.heightCells; cy += 1) {
    for (let cx = 0; cx < grid.widthCells; cx += 1) finishSample(grid, seed, { cx, cy });
  }
  return grid;
}
