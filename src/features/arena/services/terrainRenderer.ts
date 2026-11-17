import { Container, Graphics } from "pixi.js";
import { GAME_PALETTE, terrainSwatch } from "@/shared/config/gamePalette";
import { outlineWidth } from "@/shared/utils/outlineWidth";
import type { LevelDefinition, TerrainPiece } from "@/features/level/api/levelApi";
import type { MoverBody, TerrainGrid } from "@/features/arena/types/arena.types";
import { isBreakableSlot, takeDirtyChunks } from "@/features/arena/services/terrainGrid";
import { moverPieceIndices, pieceCellSlot } from "@/features/arena/services/terrainRaster";
import {
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
 */
interface MoverView {
  container: Container;
  ink: Graphics;
}

function createMoverView(level: LevelDefinition, mover: MoverBody): MoverView {
  const container = new Container({ label: "moving-part" });
  container.pivot.set(mover.pivot.x, mover.pivot.y);
  const ink = new Graphics({ label: "moving-part-ink" });
  ink.position.set(mover.origin.x, mover.origin.y);
  const fill = new Graphics({ label: "moving-part-fill" });
  drawSlabFill(fill, mover.terrainIndices.flatMap((i) => level.terrain[i] ?? []).map(slabOf));
  container.addChild(ink, fill);
  return { container, ink };
}

function placeMoverView(view: MoverView, mover: MoverBody): void {
  const { pose, pivot } = mover;
  view.container.position.set(pivot.x + pose.dx, pivot.y + pose.dy);
  view.container.rotation = pose.angle;
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
    const outlineShape = terrainContour(grid, { grow: outline.width, breakableOnly: false });
    drawContour(view.ink, outlineShape, GAME_PALETTE.ink);
  }
  view.movers.forEach((moverView, i) => {
    const mover = grid.movers[i];
    if (!mover) return;
    if (stepChanged) {
      const shape = terrainContour(mover.field, { grow: outline.width, breakableOnly: false });
      drawContour(moverView.ink, shape, GAME_PALETTE.ink);
    }
    placeMoverView(moverView, mover);
  });
  if (terrainChanged) {
    const standing = terrainContour(grid, { grow: 0, breakableOnly: true });
    view.breakableFill.visible = drawContour(view.breakableMask, standing, 0xffffff);
  }
}
