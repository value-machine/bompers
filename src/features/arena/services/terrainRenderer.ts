import { Container, Graphics } from "pixi.js";
import { terrainSwatch } from "@/shared/config/gamePalette";
import { outlineWidth } from "@/shared/utils/outlineWidth";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import type { TerrainGrid } from "@/features/arena/types/arena.types";
import { isBreakableSlot, takeDirtyChunks } from "@/features/arena/services/terrainGrid";
import { pieceCellSlot } from "@/features/arena/services/terrainRaster";
import {
  drawBreakableMasks,
  drawSlabFill,
  drawSlabInk,
  type SlabPiece,
} from "@/features/arena/services/terrainSurfaces";

/**
 * Terrain layer (DESIGN_LANGUAGE § 2–3, § 5 step 3). Every material draws as the same solid
 * rounded slab with a top lip in its piece's colour swatch; breakable terrain looks exactly like
 * unbreakable terrain, only its colour differs (owner, terrain-curves D5). Back to front:
 * - **Ink:** style E silhouette — every slab stroked at twice the outline width, fills on top, so
 *   one outer line shows. Breakable slabs' ink is clipped by the standing-terrain mask grown by the
 *   outline width; every edge a blast made (crater rims, cut faces) gets the same width of ink from
 *   the changed shape grown by the width, so the outline traces the real shape (owner,
 *   terrain-curves D7). Redrawn when the zoom-clamped width changes step.
 * - **Fills:** unbreakable slabs (with ice gloss) drawn once; breakable slabs clipped by a mask of
 *   the breakable terrain still standing (rebuilt when the sim marks chunks dirty): plain rects
 *   where no blast has been, so authored corners stay sharp, and the distance field's contour
 *   along every crater rim, so a crater cuts a true curve (terrain-curves D1, D2).
 */
export interface TerrainView {
  container: Container;
  solidInk: Graphics;
  solidFill: Graphics;
  breakableInk: Graphics;
  /** Ink along every edge a blast made (crater rims, cut faces), under the fills. */
  rimInk: Graphics;
  breakableFill: Graphics;
  masks: { cells: Graphics; ink: Graphics };
  solids: readonly SlabPiece[];
  breakables: readonly SlabPiece[];
  /** Distances at level load: cells whose samples still hold them draw the authored slab as is. */
  initialDistance: Float32Array;
  /** Outline step the ink pass was drawn at (null before the first draw). */
  inkStep: number | null;
  /** Ink width the ink mask was grown by. */
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

/** The layer graphics in draw order; breakable ink and fills are clipped by the masks. */
function createLayers() {
  const container = new Container({ label: "terrain" });
  const solidInk = new Graphics({ label: "solid-ink" });
  const solidFill = new Graphics({ label: "solid-fill" });
  const breakableInk = new Graphics({ label: "breakable-ink" });
  const rimInk = new Graphics({ label: "breakable-rim-ink" });
  const breakableFill = new Graphics({ label: "breakable-fill" });
  const masks = {
    cells: new Graphics({ label: "breakable-cell-mask" }),
    ink: new Graphics({ label: "breakable-ink-mask" }),
  };
  breakableFill.mask = masks.cells;
  breakableInk.mask = masks.ink;
  container.addChild(solidInk, breakableInk, rimInk, solidFill, breakableFill);
  container.addChild(masks.cells, masks.ink);
  return { container, solidInk, solidFill, breakableInk, rimInk, breakableFill, masks };
}

export function createTerrainView(arena: {
  terrain: TerrainGrid;
  level: LevelDefinition;
}): TerrainView {
  const grid = arena.terrain;
  const layers = createLayers();
  const { solids, breakables } = slabPieces(arena.level);
  drawSlabFill(layers.solidFill, solids);
  drawSlabFill(layers.breakableFill, breakables);
  return {
    ...layers,
    solids,
    breakables,
    initialDistance: grid.distance.slice(),
    inkStep: null,
    inkWidth: 0,
  };
}

/** Redraws what changed: the breakable masks when terrain changed, the ink on an outline step. */
export function syncTerrainView(view: TerrainView, grid: TerrainGrid, zoom: number): void {
  const outline = outlineWidth("terrain", zoom);
  const stepChanged = outline.step !== view.inkStep;
  if (stepChanged) {
    drawSlabInk(view.solidInk, view.solids, outline.width);
    drawSlabInk(view.breakableInk, view.breakables, outline.width);
    view.inkStep = outline.step;
    view.inkWidth = outline.width;
  }
  const terrainChanged = takeDirtyChunks(grid).length > 0;
  if (stepChanged || terrainChanged) {
    const any = drawBreakableMasks(
      grid,
      { ...view.masks, rimInk: view.rimInk },
      {
        initial: view.initialDistance,
        grow: view.inkWidth,
      }
    );
    view.breakableFill.visible = any;
    view.breakableInk.visible = any;
  }
}
