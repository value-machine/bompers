import { Container, Graphics } from "pixi.js";
import { terrainSwatch } from "@/shared/config/gamePalette";
import { DEBUG_INK_ON, inkColor } from "@/shared/utils/debugInk";
import { outlineWidth } from "@/shared/utils/outlineWidth";
import type { LevelDefinition, TerrainPiece } from "@/features/level/api/levelApi";
import { EMPTY_CELL, type MoverBody, type TerrainGrid } from "@/features/arena/types/arena.types";
import { FIELD_BAND_SAMPLES, takeDirtyChunks } from "@/features/arena/services/terrainGrid";
import {
  moverPieceIndices,
  pieceCellSlot,
  shiftShape,
} from "@/features/arena/services/terrainRaster";
import {
  belowLipRegion,
  boxesMeet,
  drawContour,
  drawOutline,
  drawSlabDetails,
  outlineRingIssue,
  slotLayerBoxes,
  slotLayerRegion,
  surfaceTiles,
  terrainContour,
  terrainRings,
  tileSamples,
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
 * Every body is drawn in surface tiles (`surfaceTiles`, tree-fire-perf): each tile has its own
 * rings, ink and slot fills, and a change of the terrain redraws only the tiles its dirty chunks
 * reach, so fires in several places cost their own areas, not the level. An outline step only
 * restrokes the rings the tiles have.
 */
export interface TerrainView {
  container: Container;
  /** The static terrain's ink, fills, lips and ice cues. */
  surface: BodySurface;
  /** Outline step the ink was drawn at (null before the first draw). */
  inkStep: number | null;
  /** Outline width the ink was drawn at. */
  inkWidth: number;
  /** One view per moving part, in `grid.movers` order, above the static terrain. */
  movers: MoverView[];
}

/** One body's drawing in its own grid coordinates: an ink line under its slab layers. */
interface BodySurface {
  /** The tiles' ink lines. */
  ink: Container;
  /** The slot layers in paint order, then the ice cues. */
  slabs: Container;
  /** One layer per slot, in paint order, with the box of samples the layer covers. */
  slots: Map<number, SlotLayer>;
  tiles: SurfaceTile[];
  /** Ink colour of this body's line. */
  inkColor: number;
}

/** A slot's layer: the whole of it in the lip colour, then all but the lip in the fill colour. */
interface SlotLayer {
  lips: Container;
  bodies: Container;
  box: SampleBox;
  swatch: { fill: number; lip: number };
}

/** One tile of a body's drawing: its piece of the edge, its ink and its piece of each layer. */
interface SurfaceTile {
  cells: SampleBox;
  /** The samples its drawing reads (a change there redraws it). */
  reads: SampleBox;
  /** The terrain's edge in this tile; rebuilt only when the tile changes. */
  rings: OutlineRing[];
  ink: Graphics;
  /** Lip and fill per slot, made the first time the slot's layer reaches the tile. */
  fills: Map<number, { lip: Graphics; body: Graphics }>;
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

function createBodySurface(
  grid: TerrainGrid,
  look: { pieces: SlabPiece[]; inkColor: number }
): BodySurface {
  const ink = new Container({ label: "terrain-ink" });
  const slabs = new Container({ label: "slabs" });
  const slots: BodySurface["slots"] = new Map();
  for (const [slot, box] of slotLayerBoxes(grid)) {
    const lips = new Container({ label: `slab-lip-${slot}` });
    const bodies = new Container({ label: `slab-fill-${slot}` });
    slots.set(slot, { lips, bodies, box, swatch: terrainSwatch(grid.slots[slot]?.colorId ?? "") });
    slabs.addChild(lips, bodies);
  }
  const details = new Graphics({ label: "slab-details" });
  drawSlabDetails(details, look.pieces);
  slabs.addChild(details);
  const tiles = surfaceTiles(grid).map((cells): SurfaceTile => {
    const tileInk = new Graphics({ label: "terrain-ink-tile" });
    ink.addChild(tileInk);
    return { cells, reads: tileSamples(cells), rings: [], ink: tileInk, fills: new Map() };
  });
  return { ink, slabs, slots, tiles, inkColor: look.inkColor };
}

/**
 * The boxes of samples the dirty chunks cover. Every sample whose slot or distance changed is in
 * one (`writeSample` marks its own chunk, distance upkeep included), so a tile whose reads miss
 * them all draws the same as before.
 */
function dirtyBoxes(grid: TerrainGrid, chunks: readonly number[]): SampleBox[] {
  return chunks.map((chunk) => {
    const cx = (chunk % grid.chunksX) * grid.chunkCells;
    const cy = Math.floor(chunk / grid.chunksX) * grid.chunkCells;
    return { minX: cx, minY: cy, maxX: cx + grid.chunkCells - 1, maxY: cy + grid.chunkCells - 1 };
  });
}

/** A tile's piece of one slot's layer, made (in tile order within the layer) when first drawn. */
function tileFill(slot: SlotLayer, tile: SurfaceTile, slotId: number) {
  const known = tile.fills.get(slotId);
  if (known) return known;
  const made = { lip: new Graphics(), body: new Graphics() };
  slot.lips.addChild(made.lip);
  slot.bodies.addChild(made.body);
  tile.fills.set(slotId, made);
  return made;
}

/** The slots of the solid samples a tile reads. */
function tileSlots(grid: TerrainGrid, reads: SampleBox): Set<number> {
  const slots = new Set<number>();
  const minX = Math.max(0, reads.minX);
  const maxX = Math.min(grid.widthCells - 1, reads.maxX);
  for (
    let cy = Math.max(0, reads.minY);
    cy <= Math.min(grid.heightCells - 1, reads.maxY);
    cy += 1
  ) {
    for (let cx = minX; cx <= maxX; cx += 1) {
      const slot = grid.cells[cy * grid.widthCells + cx] ?? EMPTY_CELL;
      if (slot !== EMPTY_CELL) slots.add(slot);
    }
  }
  return slots;
}

/**
 * Rebuilds one tile: its rings, and its piece of the layer of each slot it holds. A slot with no
 * sample in the tile is skipped: there its layer (that slot and every later one) is the next
 * held slot's layer, which is painted over it in full, so the tile looks the same without it.
 */
function redrawTile(surface: BodySurface, grid: TerrainGrid, tile: SurfaceTile): void {
  const { cells } = tile;
  tile.rings = terrainRings(grid, { grow: 0, cells });
  const held = tileSlots(grid, tile.reads);
  for (const [slotId, slot] of surface.slots) {
    if (!held.has(slotId)) {
      const gone = tile.fills.get(slotId);
      gone?.lip.clear();
      gone?.body.clear();
      continue;
    }
    const region = slotLayerRegion(grid, slotId, slot.box);
    const fill = tileFill(slot, tile, slotId);
    drawContour(fill.lip, terrainContour(grid, { grow: 0, region, cells }), slot.swatch.lip);
    const body = terrainContour(grid, { grow: 0, region: belowLipRegion(grid, region), cells });
    drawContour(fill.body, body, slot.swatch.fill);
  }
}

function strokeTile(tile: SurfaceTile, line: { width: number; color: number }): void {
  drawOutline(tile.ink, tile.rings, line);
}

/**
 * Redraws the tiles a change reached, and restrokes every tile's
 * ink when the outline width stepped. Returns the tiles it redrew.
 */
function syncBodySurface(
  surface: BodySurface,
  grid: TerrainGrid,
  at: { changed: readonly SampleBox[]; width: number; restroke: boolean }
): SurfaceTile[] {
  const redrawn = surface.tiles.filter((tile) =>
    at.changed.some((box) => boxesMeet(box, tile.reads))
  );
  for (const tile of redrawn) redrawTile(surface, grid, tile);
  const line = { width: at.width, color: surface.inkColor };
  for (const tile of at.restroke ? surface.tiles : redrawn) strokeTile(tile, line);
  return redrawn;
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
  surface: BodySurface;
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
  const pieces = mover.terrainIndices.flatMap((i) => level.terrain[i] ?? []);
  const surface = createBodySurface(mover.field, {
    pieces: slabPieces(pieces, mover.origin),
    inkColor: inkColor("moverOutline"),
  });
  for (const layer of [surface.ink, surface.slabs]) {
    layer.position.set(mover.origin.x, mover.origin.y);
    container.addChild(layer);
  }
  return { container, surface };
}

export function createTerrainView(arena: {
  terrain: TerrainGrid;
  level: LevelDefinition;
}): TerrainView {
  const container = new Container({ label: "terrain" });
  const moving = moverPieceIndices(arena.level);
  const pieces = arena.level.terrain.filter((_, i) => !moving.has(i));
  const surface = createBodySurface(arena.terrain, {
    pieces: slabPieces(pieces),
    inkColor: inkColor("terrainOutline"),
  });
  container.addChild(surface.ink, surface.slabs);
  const movers = arena.terrain.movers.map((mover) => createMoverView(arena.level, mover));
  for (const mover of movers) container.addChild(mover.container);
  return { container, surface, inkStep: null, inkWidth: 0, movers };
}

/** Debug ink only: logs the first broken outline ring of the redrawn tiles (terrain-ink-spikes guard). */
function reportRingIssue(what: string, grid: TerrainGrid, tiles: readonly SurfaceTile[]): void {
  if (!DEBUG_INK_ON) return;
  const rings = tiles.flatMap((tile) => tile.rings);
  const issue = outlineRingIssue(grid, rings, FIELD_BAND_SAMPLES * grid.cellSize);
  if (issue) console.warn(`[debugInk] ${what} outline: ${issue}`);
}

/** Redraws the tiles a body's change reached; restrokes all of its ink on an outline step. */
function syncBody(
  what: string,
  surface: BodySurface,
  at: { grid: TerrainGrid; width: number; restroke: boolean }
): void {
  const dirty = takeDirtyChunks(at.grid);
  if (dirty.length === 0 && !at.restroke) return;
  const redrawn = syncBodySurface(surface, at.grid, {
    changed: dirtyBoxes(at.grid, dirty),
    width: at.width,
    restroke: at.restroke,
  });
  reportRingIssue(what, at.grid, redrawn);
}

/** Redraws what the terrain's change or the outline's width step asks for. */
export function syncTerrainView(view: TerrainView, grid: TerrainGrid, zoom: number): void {
  const outline = outlineWidth("terrain", zoom);
  const restroke = outline.step !== view.inkStep;
  view.inkStep = outline.step;
  view.inkWidth = outline.width;
  syncBody("terrain", view.surface, { grid, width: outline.width, restroke });
  view.movers.forEach((moverView, i) => {
    const mover = grid.movers[i];
    if (!mover) return;
    // A part's field changes when it burns away or is blasted: outline and fills follow.
    syncBody("moving part", moverView.surface, {
      grid: mover.field,
      width: outline.width,
      restroke,
    });
    placePoseLayer(moverView.container, mover);
  });
}
