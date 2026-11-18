import { Container, Graphics } from "pixi.js";
import { GAME_PALETTE } from "@/shared/config/gamePalette";
import { inkColor } from "@/shared/utils/debugInk";
import { syncDisplayById } from "@/shared/utils/displaySync";
import { outlineWidth } from "@/shared/utils/outlineWidth";
import {
  drawContour,
  markedRegion,
  terrainContour,
  type MoverBody,
  type TerrainGrid,
} from "@/features/arena/api/arenaApi";
import {
  STAIN_LOOK,
  stainFade,
  stainSamples,
  stainStage,
} from "@/features/knockout/services/stainShape";
import { drawLooseHelmet, drawLooseTube } from "@/features/player/api/playerApi";
import { pieceAlpha, type KnockoutWorld } from "@/features/knockout/services/knockoutSim";
import type {
  GooDroplet,
  GooSplat,
  KnockoutPiece,
  KnockoutTunables,
} from "@/features/knockout/types/knockout.types";

/**
 * Knockout layers. Goo is the victim's body colour: an effect of that player's own
 * (DESIGN_LANGUAGE § 1).
 * - Right above the terrain (`stainLayer`): goo stains. A stain is not a shape laid on top; it
 *   dyes a patch of the terrain itself, see-through (owner, terrain-stains D1: "the same shape as
 *   ice"): its samples are drawn with the terrain's contour, one drawing per burst, on the arena
 *   and on each moving part's own field (in a container that follows the part). Frozen ground
 *   and fire are drawn over it. A drawing is redrawn only when one of its stains lands or runs
 *   or the terrain changes; fading changes its alpha only.
 * - Above terrain and effects, under rockets and players (`layer`): goo droplets in flight and
 *   the loose helmet and tube, one sprite each, drawn once when it appears (outline width at
 *   that zoom, like the effects); per frame only transforms and alpha change.
 * The flying blob itself is drawn by the player renderer (match feeds it `knockoutBodies`).
 */
export interface KnockoutView {
  layer: Container;
  /** Goo stains: add right above the terrain, under frozen ground and fire. */
  stainLayer: Container;
  /**
   * One drawing per burst of goo and stained field, by `<field>:<burst>` (field -1 = the arena),
   * in landing order: a burst's stains are one shape in one colour, so they never stack on each
   * other, and the burst fades as one. Stains of different bursts lie over each other,
   * see-through, the newer on top.
   */
  stains: Map<string, StainDrawing>;
  /** One container per moving part, following its pose; made when a part is first stained. */
  partLayers: Map<number, Container>;
  dropletLayer: Container;
  pieceLayer: Container;
  droplets: Map<string, Container>;
  pieces: Map<string, Container>;
}

interface StainDrawing {
  g: Graphics;
  /** What it was drawn from; it is redrawn when this changes. */
  drawn: string;
  /** Age of the burst's first landing: the whole drawing fades by it. */
  age: number;
}

export interface KnockoutFrame {
  world: KnockoutWorld;
  zoom: number;
  /** Player collision height (sizes the loose helmet and tube). */
  playerHeight: number;
  tunables: KnockoutTunables;
  respawnDelaySeconds: number;
  /** The arena's terrain: stains colour its samples and those of its moving parts. */
  terrain: TerrainGrid;
}

export function createKnockoutView(): KnockoutView {
  const stainLayer = new Container({ label: "goo-stains" });
  const dropletLayer = new Container({ label: "goo-droplets" });
  const pieceLayer = new Container({ label: "knockout-pieces" });
  const layer = new Container({ label: "knockouts" });
  layer.addChild(dropletLayer, pieceLayer);
  return {
    layer,
    stainLayer,
    stains: new Map(),
    partLayers: new Map(),
    dropletLayer,
    pieceLayer,
    droplets: new Map(),
    pieces: new Map(),
  };
}

const gooColor = (slot: number): number =>
  GAME_PALETTE.players[slot % GAME_PALETTE.players.length] ?? GAME_PALETTE.ink;

/** A round goo droplet: body colour, ink silhouette line, one white gloss dot. */
function drawDroplet(droplet: GooDroplet, width: number): Container {
  const r = droplet.body.radius;
  return new Graphics()
    .circle(0, 0, r)
    .fill(gooColor(droplet.slot))
    .stroke({ width, color: inkColor("stains", GAME_PALETTE.ink) })
    .ellipse(-0.35 * r, -0.3 * r, 0.18 * r, 0.28 * r)
    .fill({ color: GAME_PALETTE.gloss, alpha: 0.7 });
}

/** The field a stain is on: the arena (-1) or a moving part's own field, with its offset. */
function stainField(splat: GooSplat, terrain: TerrainGrid) {
  const mover = splat.rides ? terrain.movers[splat.rides.mover] : undefined;
  if (!mover) return { id: -1, field: terrain, x: splat.x, y: splat.y };
  const { origin } = mover;
  return {
    id: splat.rides!.mover,
    field: mover.field,
    x: splat.x - origin.x,
    y: splat.y - origin.y,
  };
}

/** The layer that follows one moving part's pose, made when the part is first stained. */
function partLayer(view: KnockoutView, mover: MoverBody, id: number): Container {
  const known = view.partLayers.get(id);
  if (known) return known;
  const layer = new Container({ label: `goo-stains-part-${id}` });
  layer.pivot.set(mover.pivot.x, mover.pivot.y);
  view.partLayers.set(id, layer);
  view.stainLayer.addChild(layer);
  return layer;
}

/** A burst's stains on one field: the stains of one knockout (`<seq>:…` keys) that share it. */
interface StainGroup {
  id: number;
  slot: number;
  field: TerrainGrid;
  members: { splat: GooSplat; x: number; y: number }[];
}

function stainGroups(frame: KnockoutFrame): Map<string, StainGroup> {
  const groups = new Map<string, StainGroup>();
  for (const splat of frame.world.splats) {
    const { id, field, x, y } = stainField(splat, frame.terrain);
    const key = `${id}:${splat.key.split(":")[0]}`;
    const group = groups.get(key) ?? { id, slot: splat.slot, field, members: [] };
    group.members.push({ splat, x, y });
    groups.set(key, group);
  }
  return groups;
}

/** The drawing of one group, made on first use (a moving part's in the part's layer). */
function stainDrawing(view: KnockoutView, frame: KnockoutFrame, entry: [string, StainGroup]) {
  const [key, group] = entry;
  const known = view.stains.get(key);
  if (known) return known;
  const g = new Graphics({ label: `goo-stain-${key}` });
  const mover = frame.terrain.movers[group.id];
  if (mover) g.position.set(mover.origin.x, mover.origin.y);
  (mover ? partLayer(view, mover, group.id) : view.stainLayer).addChild(g);
  const drawing: StainDrawing = { g, drawn: "", age: 0 };
  view.stains.set(key, drawing);
  return drawing;
}

/** Redraws a group when a stain landed or ran, or its terrain changed: the stained samples' contour. */
function drawStainGroup(drawing: StainDrawing, group: StainGroup): void {
  const { field, members } = group;
  const stages = members.map(({ splat }) => `${splat.key}@${stainStage(splat, splat.age)}`);
  const drawn = `${field.shapeVersion}|${stages.join(",")}`;
  if (drawn === drawing.drawn) return;
  drawing.drawn = drawn;
  const samples = members.flatMap(({ splat, x, y }) =>
    stainSamples(field, splat, { x, y, age: splat.age })
  );
  const region = markedRegion(field, samples);
  if (!region) drawing.g.clear();
  else {
    const color = inkColor("stains", gooColor(group.slot));
    drawContour(drawing.g, terrainContour(field, { grow: 0, region }), color);
  }
}

/** Matches the stain drawings to the landed goo, fades them and moves the parts' layers. */
function syncStains(view: KnockoutView, frame: KnockoutFrame): void {
  const groups = stainGroups(frame);
  const timing = {
    respawnDelaySeconds: frame.respawnDelaySeconds,
    splatSeconds: frame.tunables.splatSeconds,
  };
  for (const [key, drawing] of view.stains) {
    if (groups.has(key)) continue;
    drawing.g.destroy();
    view.stains.delete(key);
  }
  for (const entry of groups) {
    const drawing = stainDrawing(view, frame, entry);
    drawStainGroup(drawing, entry[1]);
    // The burst fades by its first landing, also after that stain itself is gone.
    drawing.age = Math.max(drawing.age, ...entry[1].members.map(({ splat }) => splat.age));
    drawing.g.alpha = STAIN_LOOK.alpha * (1 - stainFade(drawing.age, timing));
  }
  placePartLayers(view, frame.terrain);
}

/** Moves each stained part's layer to the part's pose. */
function placePartLayers(view: KnockoutView, terrain: TerrainGrid): void {
  for (const [id, layer] of view.partLayers) {
    const mover = terrain.movers[id];
    if (!mover) continue;
    layer.position.set(mover.pivot.x + mover.pose.dx, mover.pivot.y + mover.pose.dy);
    layer.rotation = mover.pose.angle;
  }
}

function drawPiece(piece: KnockoutPiece, frame: KnockoutFrame, width: number): Container {
  if (piece.kind === "tube" && piece.itemId)
    return drawLooseTube(piece.itemId, frame.playerHeight, width);
  return drawLooseHelmet(piece.slot, frame.playerHeight, width);
}

/** Matches the layer to the knockout world. Call once per rendered frame. */
export function syncKnockoutView(view: KnockoutView, frame: KnockoutFrame): void {
  const width = outlineWidth("character", frame.zoom).width;
  const { world } = frame;
  syncStains(view, frame);
  syncDisplayById(view.droplets, view.dropletLayer, {
    list: world.droplets,
    key: (droplet) => droplet.key,
    create: (droplet) => drawDroplet(droplet, width),
    place: (sprite, droplet) => sprite.position.set(droplet.body.x, droplet.body.y),
  });
  syncDisplayById(view.pieces, view.pieceLayer, {
    list: world.pieces,
    key: (piece) => piece.key,
    create: (piece) => drawPiece(piece, frame, width),
    place: (sprite, piece) => {
      sprite.position.set(piece.body.x, piece.body.y);
      sprite.rotation = piece.body.angle;
      sprite.alpha = pieceAlpha(piece, frame.tunables.blinkSeconds);
    },
  });
}
