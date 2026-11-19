import { Container, Graphics } from "pixi.js";
import { terrainSwatch } from "@/shared/config/gamePalette";
import { DEBUG_INK_ON, inkColor } from "@/shared/utils/debugInk";
import { outlineWidth } from "@/shared/utils/outlineWidth";
import type { LevelDefinition, TerrainPiece } from "@/features/level/api/levelApi";
import type { MoverBody, TerrainGrid } from "@/features/arena/types/arena.types";
import { FIELD_BAND_SAMPLES, takeDirtyChunks } from "@/features/arena/services/terrainGrid";
import {
  moverPieceIndices,
  pieceCellSlot,
  shiftShape,
} from "@/features/arena/services/terrainRaster";
import {
  belowLipRegion,
  drawContour,
  drawOutline,
  drawSlabDetails,
  outlineRingIssue,
  slotLayerBoxes,
  slotLayerRegion,
  terrainContour,
  terrainRings,
  type OutlineRing,
  type SampleBox,
  type SlabPiece,
} from "@/features/arena/services/terrainSurfaces";

/**
 * Terrain layer (DESIGN_LANGUAGE § 2–3, § 5 step 3). Every material draws as the same solid
 * rounded slab with a top lip in its piece's colour swatch; breakable terrain looks exactly like
 * unbreakable terrain, only its colour differs (owner, terrain-curves D5). One rule shapes the
 * outline, the fills and the cut (owner, terrain-curves D8): the contour of the terrain distance
 * field, read from the current terrain only. Back to front, per body:
 * - **Ink:** a line along the terrain's edge (outline-system D1): the contour's rings stroked at
 *   twice the zoom-clamped outline width, so one outline of the same width shows around every
 *   visible edge, authored or blasted, and none where terrain is gone. The fills hide its inner
 *   half; it is never a shape under them, so a fill that is late or missing leaves no ink shape.
 * - **Fills:** one layer per material + colour slot, painted in slot order (outline-system D6):
 *   the field's contour of that slot and every later one, so the first layer is the whole
 *   terrain, touching slabs of one colour are one fill with no seam, two colours meet without a
 *   gap, and a crater or a burn-out cuts them all. No clip mask.
 * - **Lips:** each layer is painted in its lip colour first and its fill colour over that
 *   without the lip (`belowLipRegion`), which leaves a lighter band along every edge that faces
 *   up into the air (outline-system D7). Then the ice cues.
 * Rings and fills are rebuilt when the sim changes the terrain (a slot's layer only when the
 * change is near it); an outline step only restrokes the rings it has.
 */
export interface TerrainView {
  container: Container;
  ink: Graphics;
  /** The static terrain's fill layers (each with its lip) and ice cues. */
  slabs: SlabLayers;
  /** Outline step the ink was drawn at (null before the first draw). */
  inkStep: number | null;
  /** Outline width the ink was drawn at. */
  inkWidth: number;
  /** The terrain's edge the ink line follows; rebuilt only when the terrain changes. */
  rings: OutlineRing[];
  /** One view per moving part, in `grid.movers` order, above the static terrain. */
  movers: MoverView[];
}

/** One body's slab drawing over its ink, in the body's own grid coordinates. */
interface SlabLayers {
  layer: Container;
  /** One fill layer per slot, in paint order, with the box of samples the layer covers. */
  fills: Map<number, SlotLayer>;
}

/** A slot's layer: the whole of it in the lip colour, then all but the lip in the fill colour. */
interface SlotLayer {
  lip: Graphics;
  body: Graphics;
  box: SampleBox;
  swatch: { fill: number; lip: number };
}

/** A body's pieces in its own grid coordinates (`origin` is where its grid starts). */
function slabPieces(pieces: readonly TerrainPiece[], origin = { x: 0, y: 0 }): SlabPiece[] {
  return pieces.map((piece) => {
    const info = pieceCellSlot(piece);
    return {
      shape: shiftShape(piece.shape, origin),
      swatch: terrainSwatch(info.colorId),
      surface: info.surface,
    };
  });
}

function createSlabLayers(grid: TerrainGrid, pieces: SlabPiece[]): SlabLayers {
  const layer = new Container({ label: "slabs" });
  const fills: SlabLayers["fills"] = new Map();
  for (const [slot, box] of slotLayerBoxes(grid)) {
    const lip = new Graphics({ label: `slab-lip-${slot}` });
    const body = new Graphics({ label: `slab-fill-${slot}` });
    fills.set(slot, { lip, body, box, swatch: terrainSwatch(grid.slots[slot]?.colorId ?? "") });
    layer.addChild(lip, body);
  }
  const details = new Graphics({ label: "slab-details" });
  drawSlabDetails(details, pieces);
  layer.addChild(details);
  return { layer, fills };
}

/** The box of samples the dirty chunks cover, grown by how far a change moves distances. */
function dirtyBox(grid: TerrainGrid, chunks: readonly number[]): SampleBox {
  const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const pad = FIELD_BAND_SAMPLES + 1;
  for (const chunk of chunks) {
    const cx = (chunk % grid.chunksX) * grid.chunkCells;
    const cy = Math.floor(chunk / grid.chunksX) * grid.chunkCells;
    box.minX = Math.min(box.minX, cx - pad);
    box.minY = Math.min(box.minY, cy - pad);
    box.maxX = Math.max(box.maxX, cx + grid.chunkCells - 1 + pad);
    box.maxY = Math.max(box.maxY, cy + grid.chunkCells - 1 + pad);
  }
  return box;
}

const boxesMeet = (a: SampleBox, b: SampleBox): boolean =>
  a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;

/** Redraws the layers of the slots a change reached (all of them without `changed`). */
function syncSlabLayers(slabs: SlabLayers, grid: TerrainGrid, changed?: SampleBox): void {
  for (const [slot, fill] of slabs.fills) {
    if (changed && !boxesMeet(fill.box, changed)) continue;
    const region = slotLayerRegion(grid, slot, fill.box);
    drawContour(fill.lip, terrainContour(grid, { grow: 0, region }), fill.swatch.lip);
    const body = terrainContour(grid, { grow: 0, region: belowLipRegion(grid, region) });
    drawContour(fill.body, body, fill.swatch.fill);
  }
}

/**
 * One moving part's view (moving-parts D16): its slabs over an ink line along its own local
 * field's edge (the same one-rule outline and fills as static terrain), drawn in the part's own
 * grid in the rest pose, in a container turned about the pivot and shifted by the pose each
 * frame. No motion cue (B1). A part that burns away or is blasted is cut where its field is
 * (mover-materials-l2, -l4).
 */
interface MoverView {
  container: Container;
  ink: Graphics;
  slabs: SlabLayers;
  /** The field's `shapeVersion` the rings and slabs were drawn at (-1 before the first draw). */
  shapeSeen: number;
  /** The part's edge its ink line follows. */
  rings: OutlineRing[];
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
  // A part's field starts at its origin in the rest pose; everything is drawn from the field.
  const ink = new Graphics({ label: "moving-part-ink" });
  ink.position.set(mover.origin.x, mover.origin.y);
  const pieces = mover.terrainIndices.flatMap((i) => level.terrain[i] ?? []);
  const slabs = createSlabLayers(mover.field, slabPieces(pieces, mover.origin));
  slabs.layer.position.set(mover.origin.x, mover.origin.y);
  container.addChild(ink, slabs.layer);
  return { container, ink, slabs, shapeSeen: -1, rings: [] };
}

export function createTerrainView(arena: {
  terrain: TerrainGrid;
  level: LevelDefinition;
}): TerrainView {
  const container = new Container({ label: "terrain" });
  const ink = new Graphics({ label: "terrain-ink" });
  const moving = moverPieceIndices(arena.level);
  const pieces = arena.level.terrain.filter((_, i) => !moving.has(i));
  const slabs = createSlabLayers(arena.terrain, slabPieces(pieces));
  container.addChild(ink, slabs.layer);
  const movers = arena.terrain.movers.map((mover) => createMoverView(arena.level, mover));
  for (const mover of movers) container.addChild(mover.container);
  return { container, ink, slabs, inkStep: null, inkWidth: 0, rings: [], movers };
}

/** Debug ink only: logs the first broken outline ring (terrain-ink-spikes guard). */
function reportRingIssue(what: string, grid: TerrainGrid, rings: readonly OutlineRing[]): void {
  if (!DEBUG_INK_ON) return;
  const issue = outlineRingIssue(grid, rings, FIELD_BAND_SAMPLES * grid.cellSize);
  if (issue) console.warn(`[debugInk] ${what} outline: ${issue}`);
}

/** Redraws what the terrain's change or the outline's width step asks for. */
export function syncTerrainView(view: TerrainView, grid: TerrainGrid, zoom: number): void {
  const outline = outlineWidth("terrain", zoom);
  const stepChanged = outline.step !== view.inkStep;
  const dirty = takeDirtyChunks(grid);
  const terrainChanged = dirty.length > 0;
  if (terrainChanged) {
    view.rings = terrainRings(grid, { grow: 0 });
    reportRingIssue("terrain", grid, view.rings);
    syncSlabLayers(view.slabs, grid, dirtyBox(grid, dirty));
  }
  if (stepChanged || terrainChanged) {
    view.inkStep = outline.step;
    view.inkWidth = outline.width;
    drawOutline(view.ink, view.rings, { width: outline.width, color: inkColor("terrainOutline") });
  }
  view.movers.forEach((moverView, i) => {
    const mover = grid.movers[i];
    if (!mover) return;
    // A part's field changes when it burns away or is blasted: outline and fills follow.
    const shapeChanged = mover.field.shapeVersion !== moverView.shapeSeen;
    if (shapeChanged) {
      moverView.shapeSeen = mover.field.shapeVersion;
      moverView.rings = terrainRings(mover.field, { grow: 0 });
      reportRingIssue("moving part", mover.field, moverView.rings);
      syncSlabLayers(moverView.slabs, mover.field);
    }
    if (stepChanged || shapeChanged) {
      const line = { width: outline.width, color: inkColor("moverOutline") };
      drawOutline(moverView.ink, moverView.rings, line);
    }
    placePoseLayer(moverView.container, mover);
  });
}
