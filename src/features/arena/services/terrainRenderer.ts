import { Container, Graphics } from "pixi.js";
import { terrainSwatch } from "@/shared/config/gamePalette";
import { inkColor } from "@/shared/utils/debugInk";
import { outlineWidth } from "@/shared/utils/outlineWidth";
import type { LevelDefinition, TerrainPiece } from "@/features/level/api/levelApi";
import type { MoverBody, TerrainGrid } from "@/features/arena/types/arena.types";
import { isBreakableSlot, takeDirtyChunks } from "@/features/arena/services/terrainGrid";
import { moverPieceIndices, pieceCellSlot } from "@/features/arena/services/terrainRaster";
import {
  breakableRegion,
  drawContour,
  drawSlabFill,
  terrainContour,
  type SlabPiece,
} from "@/features/arena/services/terrainSurfaces";

/**
 * Terrain layer (DESIGN_LANGUAGE § 2–3, § 5 step 3). Every material draws as the same solid
 * rounded slab with a top lip in its piece's colour swatch; breakable terrain looks exactly like
 * unbreakable terrain, only its colour differs (owner, terrain-curves D5). One rule shapes both
 * the outline and the cut (owner, terrain-curves D8): the contour of the terrain distance field,
 * read from the current terrain only. Back to front:
 * - **Ink:** the terrain grown by the zoom-clamped outline width, filled in ink: one outline of
 *   the same width around every visible edge, authored or blasted, and none where terrain is gone.
 * - **Fills:** unbreakable slabs (with lip and ice gloss) drawn once; breakable slabs clipped by
 *   the contour of the breakable terrain still standing.
 * Ink and clip are rebuilt when the sim marks terrain dirty; the ink also on an outline step.
 */
export interface TerrainView {
  container: Container;
  ink: Graphics;
  solidFill: Graphics;
  breakableFill: Graphics;
  breakableMask: Graphics;
  /** Outline step the ink was drawn at (null before the first draw). */
  inkStep: number | null;
  /** Outline width the ink was drawn at. */
  inkWidth: number;
  /** One view per moving part, in `grid.movers` order, above the static terrain. */
  movers: MoverView[];
}

const slabOf = (piece: TerrainPiece): SlabPiece => {
  const slot = pieceCellSlot(piece);
  return { shape: piece.shape, swatch: terrainSwatch(slot.colorId), surface: slot.surface };
};

/** Static slabs by breakability (moving parts are drawn by their own views). */
function slabPieces(level: LevelDefinition): { solids: SlabPiece[]; breakables: SlabPiece[] } {
  const solids: SlabPiece[] = [];
  const breakables: SlabPiece[] = [];
  const moving = moverPieceIndices(level);
  level.terrain.forEach((piece, i) => {
    if (moving.has(i)) return;
    (isBreakableSlot(pieceCellSlot(piece)) ? breakables : solids).push(slabOf(piece));
  });
  return { solids, breakables };
}

/**
 * One moving part's view (moving-parts D16): its slabs in rest-pose world coordinates under an
 * ink outline from its own local field (the same one-rule outline as static terrain), in a
 * container turned about the pivot and shifted by the pose each frame. No motion cue (B1).
 * Breakable slabs are clipped by the part's breakable field still standing, like static terrain,
 * so a part that burns away is cut where it burnt (mover-materials-l2).
 */
interface MoverView {
  container: Container;
  ink: Graphics;
  /** Clip of the part's breakable slabs: the breakable part of its field still standing. */
  breakableFill: Graphics;
  breakableMask: Graphics;
  /** The field's `shapeVersion` the ink and clip were drawn at (-1 before the first draw). */
  shapeSeen: number;
}

/**
 * A layer that follows one moving part (mover-materials-l2, code-style F2: the terrain's part
 * view, goo stains and fire each draw on a part): children are drawn in the part's rest pose,
 * in world coordinates, and `placePoseLayer` turns the layer about the part's pivot and shifts
 * it by the pose each frame.
 */
export function createPoseLayer(mover: MoverBody, label: string): Container {
  const layer = new Container({ label });
  layer.pivot.set(mover.pivot.x, mover.pivot.y);
  return layer;
}

/** Puts a pose layer where its part is this frame. */
export function placePoseLayer(layer: Container, mover: MoverBody): void {
  const { pose, pivot } = mover;
  layer.position.set(pivot.x + pose.dx, pivot.y + pose.dy);
  layer.rotation = pose.angle;
}

function createMoverView(level: LevelDefinition, mover: MoverBody): MoverView {
  const container = createPoseLayer(mover, "moving-part");
  const ink = new Graphics({ label: "moving-part-ink" });
  ink.position.set(mover.origin.x, mover.origin.y);
  // A part's field starts at its origin in the rest pose; ink and clip are drawn from the field.
  const breakableMask = new Graphics({ label: "moving-part-breakable-mask" });
  breakableMask.position.set(mover.origin.x, mover.origin.y);
  const pieces = mover.terrainIndices.flatMap((i) => level.terrain[i] ?? []);
  const isBreakable = (piece: TerrainPiece): boolean => isBreakableSlot(pieceCellSlot(piece));
  const solidFill = new Graphics({ label: "moving-part-fill" });
  drawSlabFill(solidFill, pieces.filter((piece) => !isBreakable(piece)).map(slabOf));
  const breakableFill = new Graphics({ label: "moving-part-breakable-fill" });
  drawSlabFill(breakableFill, pieces.filter(isBreakable).map(slabOf));
  breakableFill.mask = breakableMask;
  container.addChild(ink, solidFill, breakableFill, breakableMask);
  return { container, ink, breakableFill, breakableMask, shapeSeen: -1 };
}

export function createTerrainView(arena: {
  terrain: TerrainGrid;
  level: LevelDefinition;
}): TerrainView {
  const container = new Container({ label: "terrain" });
  const ink = new Graphics({ label: "terrain-ink" });
  const solidFill = new Graphics({ label: "solid-fill" });
  const breakableFill = new Graphics({ label: "breakable-fill" });
  const breakableMask = new Graphics({ label: "breakable-mask" });
  breakableFill.mask = breakableMask;
  container.addChild(ink, solidFill, breakableFill, breakableMask);
  const { solids, breakables } = slabPieces(arena.level);
  drawSlabFill(solidFill, solids);
  drawSlabFill(breakableFill, breakables);
  const movers = arena.terrain.movers.map((mover) => createMoverView(arena.level, mover));
  for (const mover of movers) container.addChild(mover.container);
  return {
    container,
    ink,
    solidFill,
    breakableFill,
    breakableMask,
    inkStep: null,
    inkWidth: 0,
    movers,
  };
}

/** Redraws the ink and the breakable clip when terrain changed or the outline width stepped. */
export function syncTerrainView(view: TerrainView, grid: TerrainGrid, zoom: number): void {
  const outline = outlineWidth("terrain", zoom);
  const stepChanged = outline.step !== view.inkStep;
  const terrainChanged = takeDirtyChunks(grid).length > 0;
  if (stepChanged || terrainChanged) {
    view.inkStep = outline.step;
    view.inkWidth = outline.width;
    const outlineShape = terrainContour(grid, { grow: outline.width });
    drawContour(view.ink, outlineShape, inkColor("terrainOutline"));
  }
  view.movers.forEach((moverView, i) => {
    const mover = grid.movers[i];
    if (!mover) return;
    // A part's field changes when it burns away (mover-materials-l2): outline and clip follow.
    const shapeChanged = mover.field.shapeVersion !== moverView.shapeSeen;
    if (stepChanged || shapeChanged) {
      const shape = terrainContour(mover.field, { grow: outline.width });
      drawContour(moverView.ink, shape, inkColor("moverOutline"));
    }
    if (shapeChanged) {
      moverView.shapeSeen = mover.field.shapeVersion;
      const region = breakableRegion(mover.field);
      const standing = terrainContour(mover.field, { grow: 0, region });
      moverView.breakableFill.visible = drawContour(moverView.breakableMask, standing, 0xffffff);
    }
    placePoseLayer(moverView.container, mover);
  });
  if (terrainChanged) {
    const standing = terrainContour(grid, { grow: 0, region: breakableRegion(grid) });
    view.breakableFill.visible = drawContour(view.breakableMask, standing, 0xffffff);
  }
}
