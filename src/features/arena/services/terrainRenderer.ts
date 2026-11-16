import { Container, Graphics } from "pixi.js";
import { GAME_PALETTE, terrainSwatch } from "@/shared/config/gamePalette";
import { outlineWidth } from "@/shared/utils/outlineWidth";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import type { TerrainGrid } from "@/features/arena/types/arena.types";
import { isBreakableSlot, takeDirtyChunks } from "@/features/arena/services/terrainGrid";
import { pieceCellSlot } from "@/features/arena/services/terrainRaster";
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
}

function slabPieces(level: LevelDefinition): { solids: SlabPiece[]; breakables: SlabPiece[] } {
  const solids: SlabPiece[] = [];
  const breakables: SlabPiece[] = [];
  for (const piece of level.terrain) {
    const slot = pieceCellSlot(piece);
    const slab = { shape: piece.shape, swatch: terrainSwatch(slot.colorId), surface: slot.surface };
    (isBreakableSlot(slot) ? breakables : solids).push(slab);
  }
  return { solids, breakables };
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
  return { container, ink, solidFill, breakableFill, breakableMask, inkStep: null, inkWidth: 0 };
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
  if (terrainChanged) {
    const standing = terrainContour(grid, { grow: 0, breakableOnly: true });
    view.breakableFill.visible = drawContour(view.breakableMask, standing, 0xffffff);
  }
}
