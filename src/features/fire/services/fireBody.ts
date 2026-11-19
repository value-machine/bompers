import { Container, Graphics } from "pixi.js";
import { GAME_PALETTE } from "@/shared/config/gamePalette";
import {
  EMPTY_CELL,
  boxShapeVersion,
  drawContour,
  drawOutline,
  markedRegion,
  surfaceTiles,
  terrainContour,
  terrainRings,
  type SampleBox,
  type TerrainGrid,
} from "@/features/arena/api/arenaApi";
import { burningSamples } from "@/features/fire/services/fireSim";
import { FLAME_LOOK } from "@/features/fire/services/flameShapes";
import type { GroundFire } from "@/features/fire/types/fire.types";

/**
 * The burning terrain's body (element-overlay-shape D1): the terrain's contour limited to the
 * burning samples: an ink line along its edge (stroked at twice the outline width, the ember
 * fill hides the inner half), the ember fill, and the fresh samples' inside in amber.
 *
 * Drawn in the terrain's surface tiles (tree-fire-perf): each tile is redrawn only when its own
 * burning samples, fresh samples or terrain changed, so fires in several places cost their own
 * areas, not the box around all of them. Marched per tile, the pieces join into the same shape
 * and line as one march over the whole body (`surfaceTiles`).
 */
export interface FireBodyView {
  /** The tiles' ink lines: add under the flames' ink. */
  ink: Container;
  /** The ember fills, then the hot insides: add above the flames' ink. */
  fill: Container;
  hot: Container;
  /** The body's tiles; a tile's graphics are made when fire first reaches it. */
  tiles: FireBodyTile[];
  /** What the body was last checked at; tiles are looked at again when this changes. */
  key: string;
}

interface FireBodyTile {
  cells: SampleBox;
  /** Samples whose marks or terrain the tile's drawing reads. */
  reads: SampleBox;
  /** What the tile was drawn from (its samples, the terrain there and the ink width). */
  key: string;
  drawn: { ink: Graphics; fill: Graphics; hot: Graphics } | null;
}

/** What one body's fire body is drawn from this frame. */
export interface FireBodyFrame {
  fire: GroundFire;
  terrain: TerrainGrid;
  timeSeconds: number;
  burnSeconds: number;
  /** Width and colour of the body's ink line. */
  ink: number;
  inkColor: number;
}

const COLORS = GAME_PALETTE.fire;
/** Seconds between redraws of the hot inside while a fire burns (it fades as samples age). */
const HOT_STEP_SECONDS = 0.25;

export function createFireBodyView(): FireBodyView {
  return {
    ink: new Container({ label: "fire-body-ink" }),
    fill: new Container({ label: "fire-body" }),
    hot: new Container({ label: "fire-body-hot" }),
    tiles: [],
    key: "",
  };
}

/**
 * The samples a tile reads: its cells' corners and, for how marked their neighbours are
 * (`markedRegion`), one more sample all round.
 */
const fireTileReads = (cells: SampleBox): SampleBox => ({
  minX: cells.minX - 1,
  minY: cells.minY - 1,
  maxX: cells.maxX + 2,
  maxY: cells.maxY + 2,
});

/** The burning and fresh samples each tile reads, by tile. */
interface TileMarks {
  burning: number[];
  fresh: number[];
}

const inBox = (box: SampleBox, at: { cx: number; cy: number }): boolean =>
  at.cx >= box.minX && at.cx <= box.maxX && at.cy >= box.minY && at.cy <= box.maxY;

/** The tiles that read sample (cx, cy): its own and, near its edge, its neighbours. */
function readingTiles(body: FireBodyView, at: { cx: number; cy: number; tilesX: number }) {
  const size = tileSize(body);
  const tx = Math.floor((at.cx + 1) / size);
  const ty = Math.floor((at.cy + 1) / size);
  const ids: number[] = [];
  for (let y = ty - 1; y <= ty + 1; y += 1) {
    for (let x = tx - 1; x <= tx + 1; x += 1) {
      const reads = x >= 0 && x < at.tilesX ? body.tiles[y * at.tilesX + x]?.reads : undefined;
      const inside = reads !== undefined && inBox(reads, at);
      if (inside) ids.push(y * at.tilesX + x);
    }
  }
  return ids;
}

/** Hands each burning sample to every tile that reads it, marking the fresh ones too. */
function bucketByTile(
  body: FireBodyView,
  terrain: TerrainGrid,
  marks: { burning: readonly number[]; isFresh: (index: number) => boolean }
): Map<number, TileMarks> {
  const tilesX = Math.ceil((terrain.widthCells + 1) / tileSize(body));
  const byTile = new Map<number, TileMarks>();
  for (const index of marks.burning) {
    if ((terrain.cells[index] ?? EMPTY_CELL) === EMPTY_CELL) continue;
    const cx = index % terrain.widthCells;
    const cy = Math.floor(index / terrain.widthCells);
    const fresh = marks.isFresh(index);
    for (const id of readingTiles(body, { cx, cy, tilesX })) {
      const tile = byTile.get(id) ?? { burning: [], fresh: [] };
      tile.burning.push(index);
      if (fresh) tile.fresh.push(index);
      byTile.set(id, tile);
    }
  }
  return byTile;
}

/** Contour cells per tile side, from the body's first tile. */
const tileSize = (body: FireBodyView): number => {
  const first = body.tiles[0]?.cells;
  return first ? first.maxX - first.minX + 1 : 1;
};

/** A set of samples as a short fingerprint: equal sets give equal keys. */
function samplesKey(samples: readonly number[]): string {
  let sum = 0;
  let mix = 0;
  for (const index of samples) {
    sum += index;
    mix = (mix + Math.imul(index + 1, 2654435761)) | 0;
  }
  return `${samples.length}.${sum}.${mix}`;
}

function tileGraphics(body: FireBodyView, tile: FireBodyTile) {
  if (tile.drawn) return tile.drawn;
  tile.drawn = { ink: new Graphics(), fill: new Graphics(), hot: new Graphics() };
  body.ink.addChild(tile.drawn.ink);
  body.fill.addChild(tile.drawn.fill);
  body.hot.addChild(tile.drawn.hot);
  return tile.drawn;
}

/** Draws one tile's piece of the body: its ink line, ember fill and hot inside. */
function drawTile(
  body: FireBodyView,
  tile: FireBodyTile,
  at: { marks: TileMarks; frame: FireBodyFrame }
): void {
  const { terrain, ink } = at.frame;
  const { cells } = tile;
  const region = markedRegion(terrain, at.marks.burning);
  if (!region) {
    for (const g of Object.values(tile.drawn ?? {})) g.clear();
    return;
  }
  const g = tileGraphics(body, tile);
  // The ink is a line along the body's edge (outline-system D1), never a shape under the fill.
  const rings = terrainRings(terrain, { grow: 0, region, cells });
  drawOutline(g.ink, rings, { width: ink, color: at.frame.inkColor });
  drawContour(g.fill, terrainContour(terrain, { grow: 0, region, cells }), COLORS.outer);
  drawHot(g.hot, { terrain, fresh: at.marks.fresh, cells });
}

/** The amber inside of the samples that caught not long ago, in from the body's edge. */
function drawHot(
  g: Graphics,
  at: { terrain: TerrainGrid; fresh: readonly number[]; cells: SampleBox }
): void {
  const region = markedRegion(at.terrain, at.fresh);
  if (!region) {
    g.clear();
    return;
  }
  const grow = -FLAME_LOOK.cluster.hotInset * at.terrain.cellSize * 2;
  drawContour(g, terrainContour(at.terrain, { grow, region, cells: at.cells }), COLORS.mid);
}

/**
 * Redraws the tiles whose part of the body changed. Looked at only when the fire, the terrain
 * or the ink width changed, and a few times a second for the hot inside.
 */
export function syncFireBody(body: FireBodyView, frame: FireBodyFrame): void {
  const { fire, terrain } = frame;
  const hotStep = Math.floor(frame.timeSeconds / HOT_STEP_SECONDS);
  const line = `${frame.ink}:${frame.inkColor}`;
  const key = `${fire.version}:${terrain.shapeVersion}:${line}:${hotStep}`;
  if (key === body.key) return;
  body.key = key;
  if (body.tiles.length === 0) {
    body.tiles = surfaceTiles(terrain).map((cells) => ({
      cells,
      reads: fireTileReads(cells),
      key: "",
      drawn: null,
    }));
  }
  const freshFor = FLAME_LOOK.cluster.hotUntil * frame.burnSeconds;
  const byTile = bucketByTile(body, terrain, {
    burning: burningSamples(fire),
    isFresh: (index) => frame.timeSeconds - (fire.igniteAt[index] ?? 0) < freshFor,
  });
  body.tiles.forEach((tile, id) => {
    const marks = byTile.get(id);
    if (!marks && !tile.drawn) return;
    const tileKey = marks
      ? `${samplesKey(marks.burning)}:${samplesKey(marks.fresh)}:${boxShapeVersion(terrain, tile.reads)}:${line}`
      : "";
    if (tileKey === tile.key) return;
    tile.key = tileKey;
    drawTile(body, tile, { marks: marks ?? { burning: [], fresh: [] }, frame });
  });
}
