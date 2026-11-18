import { Container, Graphics } from "pixi.js";
import { GAME_PALETTE } from "@/shared/config/gamePalette";
import { syncDisplayById } from "@/shared/utils/displaySync";
import { outlineWidth } from "@/shared/utils/outlineWidth";
import {
  drawContour,
  markedRegion,
  terrainContour,
  type MoverBody,
  type TerrainGrid,
} from "@/features/arena/api/arenaApi";
import { stainSamples, stainStage } from "@/features/knockout/services/stainShape";
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
 *   colours a thin coat of the terrain itself (owner, terrain-stains D1: "the same shape as
 *   ice"): its samples are drawn with the terrain's contour, per player colour, on the arena
 *   and on each moving part's own field (in a container that follows the part). Frozen ground
 *   and fire are drawn over it. Redrawn only when a stain's stage or the terrain changes.
 * - Above terrain and effects, under rockets and players (`layer`): goo droplets in flight and
 *   the loose helmet and tube, one sprite each, drawn once when it appears (outline width at
 *   that zoom, like the effects); per frame only transforms and alpha change.
 * The flying blob itself is drawn by the player renderer (match feeds it `knockoutBodies`).
 */
export interface KnockoutView {
  layer: Container;
  /** Goo stains: add right above the terrain, under frozen ground and fire. */
  stainLayer: Container;
  /** One graphics per stained field and player colour, by `<field>:<slot>` (field -1 = arena). */
  stains: Map<string, Graphics>;
  /** One container per moving part, following its pose; made when a part is first stained. */
  partLayers: Map<number, Container>;
  /** What the stains were drawn from; they are redrawn when this changes. */
  stainKey: string;
  dropletLayer: Container;
  pieceLayer: Container;
  droplets: Map<string, Container>;
  pieces: Map<string, Container>;
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
    stainKey: "",
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
    .stroke({ width, color: GAME_PALETTE.ink })
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

/** The graphics of one field's stains in one colour, made on first use (a part's in its layer). */
function stainGraphics(
  view: KnockoutView,
  terrain: TerrainGrid,
  group: { id: number; slot: number }
): Graphics {
  const key = `${group.id}:${group.slot}`;
  const known = view.stains.get(key);
  if (known) return known;
  const g = new Graphics({ label: `goo-stain-${key}` });
  view.stains.set(key, g);
  const mover = terrain.movers[group.id];
  if (mover) g.position.set(mover.origin.x, mover.origin.y);
  (mover ? partLayer(view, mover, group.id) : view.stainLayer).addChild(g);
  return g;
}

/** Stained samples per field and colour, by the graphics key. */
function stainedSamples(frame: KnockoutFrame) {
  const groups = new Map<
    string,
    { id: number; slot: number; field: TerrainGrid; samples: number[] }
  >();
  const timing = {
    respawnDelaySeconds: frame.respawnDelaySeconds,
    splatSeconds: frame.tunables.splatSeconds,
  };
  for (const splat of frame.world.splats) {
    const { id, field, x, y } = stainField(splat, frame.terrain);
    const key = `${id}:${splat.slot}`;
    const group = groups.get(key) ?? { id, slot: splat.slot, field, samples: [] };
    group.samples.push(...stainSamples(field, splat, { x, y, age: splat.age, timing }));
    groups.set(key, group);
  }
  return groups;
}

/** Redraws every field's stains: the terrain's contour limited to the stained samples. */
function drawStains(view: KnockoutView, frame: KnockoutFrame): void {
  const groups = stainedSamples(frame);
  for (const [key, g] of view.stains) if (!groups.has(key)) g.clear();
  for (const { id, slot, field, samples } of groups.values()) {
    const g = stainGraphics(view, frame.terrain, { id, slot });
    const region = markedRegion(field, samples);
    if (region) drawContour(g, terrainContour(field, { grow: 0, region }), gooColor(slot));
    else g.clear();
  }
}

/** Redraws the stains when one changed stage or the terrain changed; moves the parts' layers. */
function syncStains(view: KnockoutView, frame: KnockoutFrame): void {
  const { terrain, world } = frame;
  const timing = {
    respawnDelaySeconds: frame.respawnDelaySeconds,
    splatSeconds: frame.tunables.splatSeconds,
  };
  const stages = world.splats.map((splat) => `${splat.key}@${stainStage(splat.age, timing)}`);
  const key = `${terrain.shapeVersion}|${stages.join(",")}`;
  if (key !== view.stainKey) {
    view.stainKey = key;
    drawStains(view, frame);
  }
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
