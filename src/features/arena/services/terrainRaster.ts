import type { Vec2 } from "@/shared/types/gameGeometry.types";
import { motionPose } from "@/shared/utils/levelMotion";
import { shapeBounds, shapeSignedDistance } from "@/shared/utils/shapeGeometry";
import { resolveCatalogEntry } from "@/features/content-catalog/api/contentCatalogApi";
import type {
  LevelDefinition,
  LevelMover,
  TerrainPiece,
  TerrainShape,
} from "@/features/level/api/levelApi";
import {
  EMPTY_CELL,
  type MoverBody,
  type TerrainCellSlot,
  type TerrainGrid,
} from "@/features/arena/types/arena.types";
import {
  EDGE_EPSILON,
  FIELD_BAND_SAMPLES,
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

const UNKNOWN_MATERIAL = {
  id: "",
  defaultColor: "",
  toughness: null,
  friction: 1,
  surface: "plain",
  burns: false,
  douses: false,
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
    burns: entry.burns,
    douses: entry.douses,
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

/** Rasterises pieces onto a fresh grid of `size` world units: slots plus the distance field. */
function rasterizeGrid(
  pieces: readonly TerrainPiece[],
  area: { cellSize: number; w: number; h: number }
): TerrainGrid {
  const { cellSize } = area;
  const grid = createTerrainGrid({
    cellSize,
    widthCells: Math.ceil(area.w / cellSize),
    heightCells: Math.ceil(area.h / cellSize),
  });
  const seed = new Float32Array(grid.cells.length).fill(-fieldBand(grid));
  for (const piece of pieces) rasterizePiece(grid, piece, seed);
  for (let cy = 0; cy < grid.heightCells; cy += 1) {
    for (let cx = 0; cx < grid.widthCells; cx += 1) finishSample(grid, seed, { cx, cy });
  }
  return grid;
}

/** Indices of the level's terrain pieces that belong to a moving part. */
export function moverPieceIndices(level: LevelDefinition): Set<number> {
  return new Set((level.movers ?? []).flatMap((mover) => mover.terrainIndices));
}

const shiftShape = (shape: TerrainShape, by: Vec2): TerrainShape => {
  if (shape.type === "rect") return { ...shape, x: shape.x - by.x, y: shape.y - by.y };
  if (shape.type === "circle") return { ...shape, cx: shape.cx - by.x, cy: shape.cy - by.y };
  return { type: "polygon", points: shape.points.map((p) => ({ x: p.x - by.x, y: p.y - by.y })) };
};

/**
 * A moving part's body (moving-parts D11): its pieces rasterised on their own small grid around
 * their rest pose (bounding box plus the field band), starting at the pose for time 0.
 */
function buildMoverBody(level: LevelDefinition, mover: LevelMover): MoverBody {
  const { cellSize } = level.settings;
  const pieces = mover.terrainIndices.flatMap((i) => level.terrain[i] ?? []);
  const boxes = pieces.map((piece) => shapeBounds(piece.shape));
  const margin = (FIELD_BAND_SAMPLES + 1) * cellSize;
  const left = Math.floor((Math.min(...boxes.map((b) => b.x)) - margin) / cellSize) * cellSize;
  const top = Math.floor((Math.min(...boxes.map((b) => b.y)) - margin) / cellSize) * cellSize;
  const right = Math.max(...boxes.map((b) => b.x + b.w)) + margin;
  const bottom = Math.max(...boxes.map((b) => b.y + b.h)) + margin;
  const origin = { x: left, y: top };
  const field = rasterizeGrid(
    pieces.map((piece) => ({ ...piece, shape: shiftShape(piece.shape, origin) })),
    { cellSize, w: right - left, h: bottom - top }
  );
  const corners = [
    { x: left, y: top },
    { x: right, y: top },
    { x: left, y: bottom },
    { x: right, y: bottom },
  ];
  const reach = Math.max(
    ...corners.map((c) => Math.hypot(c.x - mover.pivot.x, c.y - mover.pivot.y))
  );
  const frictions = pieces.map((piece) => pieceCellSlot(piece).friction);
  const pose = motionPose(mover.motion, 0);
  return {
    motion: mover.motion,
    pivot: mover.pivot,
    origin,
    field,
    pose,
    prevPose: pose,
    reach,
    friction: frictions.reduce((sum, f) => sum + f, 0) / Math.max(1, frictions.length),
    terrainIndices: mover.terrainIndices,
    sounds: { move: mover.sounds?.move ?? null, end: mover.sounds?.end ?? null },
  };
}

/**
 * Builds the grid a (normalised) level describes: material slots plus the distance field of the
 * static terrain, and one body per moving part (whose pieces stay out of the static samples).
 */
export function buildTerrainFromLevel(level: LevelDefinition): TerrainGrid {
  const moving = moverPieceIndices(level);
  const grid = rasterizeGrid(
    level.terrain.filter((_, i) => !moving.has(i)),
    { cellSize: level.settings.cellSize, ...level.worldSize }
  );
  grid.movers = (level.movers ?? []).map((mover) => buildMoverBody(level, mover));
  return grid;
}
