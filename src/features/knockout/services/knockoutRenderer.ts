import { Container, Graphics } from "pixi.js";
import { GAME_PALETTE } from "@/shared/config/gamePalette";
import { syncDisplayById } from "@/shared/utils/displaySync";
import { outlineWidth } from "@/shared/utils/outlineWidth";
import { splatShape, type SplatShape } from "@/features/knockout/services/splatShape";
import { drawLooseHelmet, drawLooseTube } from "@/features/player/api/playerApi";
import {
  pieceAlpha,
  splatAlpha,
  type KnockoutWorld,
} from "@/features/knockout/services/knockoutSim";
import type {
  GooDroplet,
  GooSplat,
  KnockoutPiece,
  KnockoutTunables,
} from "@/features/knockout/types/knockout.types";

/**
 * Knockout layer (above terrain and effects, under rockets and players): goo splats on terrain,
 * goo droplets in flight and the loose helmet and tube. The flying blob itself is drawn by the
 * player renderer (match feeds it `knockoutBodies`). Each sprite is drawn once when it appears
 * (outline width at that zoom, like the effects); per frame only transforms and alpha change.
 * Goo is the victim's body colour: an effect of that player's own (DESIGN_LANGUAGE § 1).
 */
export interface KnockoutView {
  layer: Container;
  splatLayer: Container;
  dropletLayer: Container;
  pieceLayer: Container;
  splats: Map<string, Container>;
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
}

/** A wall splat's streak runs down to its full length (`splatShape`) over this long. */
const STREAK = { seconds: 0.8 };

export function createKnockoutView(): KnockoutView {
  const splatLayer = new Container({ label: "goo-splats" });
  const dropletLayer = new Container({ label: "goo-droplets" });
  const pieceLayer = new Container({ label: "knockout-pieces" });
  const layer = new Container({ label: "knockouts" });
  layer.addChild(splatLayer, dropletLayer, pieceLayer);
  return {
    layer,
    splatLayer,
    dropletLayer,
    pieceLayer,
    splats: new Map(),
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

/**
 * A splat flat on the surface it hit, no outline: a wide lens on a floor (with satellite dots),
 * a hanging drip under a ceiling, a tall smear with a streak running down on a wall.
 */
/** Traces the splat's seeded shape (`splatShape`): its blobs and its hanging drips. */
function traceSplat(g: Graphics, shape: SplatShape): Graphics {
  for (const blob of shape.blobs) g.ellipse(blob.x, blob.y, blob.rx, blob.ry);
  for (const drip of shape.drips) {
    const { x, halfWidth: w, length } = drip;
    g.moveTo(x - w, 0)
      .quadraticCurveTo(x - w, 0.7 * length, x, length)
      .quadraticCurveTo(x + w, 0.7 * length, x + w, 0);
  }
  return g;
}

function drawSplat(splat: GooSplat): Container {
  const r = splat.radius;
  const color = gooColor(splat.slot);
  const shape = splatShape(splat);
  const root = new Container();
  root.addChild(traceSplat(new Graphics(), shape).fill(color));
  if (shape.streak > 0) {
    const streak = new Graphics()
      .roundRect(-0.25 * r, 0, 0.5 * r, shape.streak, 0.25 * r)
      .fill(color);
    streak.label = "streak";
    root.addChild(streak);
  }
  root.position.set(splat.x, splat.y);
  return root;
}

function placeSplat(sprite: Container, splat: GooSplat, frame: KnockoutFrame): void {
  sprite.alpha = splatAlpha(splat.age, {
    respawnDelaySeconds: frame.respawnDelaySeconds,
    splatSeconds: frame.tunables.splatSeconds,
  });
  const streak = sprite.getChildByLabel("streak");
  if (streak) streak.scale.y = Math.min(1, splat.age / STREAK.seconds);
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
  syncDisplayById(view.splats, view.splatLayer, {
    list: world.splats,
    key: (splat) => splat.key,
    create: drawSplat,
    place: (sprite, splat) => placeSplat(sprite, splat, frame),
  });
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
