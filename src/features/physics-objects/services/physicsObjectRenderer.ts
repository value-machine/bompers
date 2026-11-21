import { Container, Graphics } from "pixi.js";
import { GAME_PALETTE } from "@/shared/config/gamePalette";
import { inkStroke, outlineWidth } from "@/shared/utils/outlineWidth";
import { popInScale } from "@/shared/utils/easing";
import { syncDisplayById } from "@/shared/utils/displaySync";
import {
  createContactShadowLayer,
  syncContactShadows,
  type ContactShadowLayer,
} from "@/shared/utils/contactShadowLayer";
import type { BallBodySpec } from "@/shared/types/physicsBody.types";
import { surfaceBelow, type TerrainGrid } from "@/features/arena/api/arenaApi";
import type {
  ObjectMoment,
  PhysicsObject,
  PhysicsObjectsState,
} from "@/features/physics-objects/types/physicsObject.types";

/**
 * Physics-object layers (DESIGN_LANGUAGE § 1 Effects "Beach ball"; owner, physics-objects Q1):
 * a ball of equal panel wedges turned by its roll, one ink silhouette line (prop width), a fixed
 * gloss, a contact shadow while airborne. Juice (GAME_JUICE ledger, render only): a bounce
 * squashes it wide by the impact (volume kept, `squash` window), it pops in when it comes back
 * (`effect` window), and a pop or come-back throws a smoke ring (`effect` window). Whole-object
 * state: flame tongues all round while burning, a frost disc while frozen.
 */

/** Strongest bounce squash: width × (1 + this), height ÷ the same (inside the JUICE band). */
const BOUNCE_WIDEN = 0.25;
/** Squash recovery (seconds), inside `JUICE_WINDOWS.squash`. */
const SQUASH_SECONDS = 0.15;
/** Pop-in and smoke ring (seconds), inside `JUICE_WINDOWS.effect`. */
const EFFECT_SECONDS = 0.22;
/** Hub at the centre where the wedges meet, × radius. */
const HUB = 0.2;
/** Flame tongues around a burning ball. */
const FLAMES = 7;

/** The juice numbers, for the scale check (`physicsObjectRenderer.test.ts`). */
export const PHYSICS_OBJECT_JUICE = { SQUASH_SECONDS, EFFECT_SECONDS, BOUNCE_WIDEN } as const;

export interface PhysicsObjectsView {
  container: Container;
  shadows: ContactShadowLayer;
  balls: Container;
  sprites: Map<string, Container>;
  overlay: Graphics;
}

export interface PhysicsObjectsFrame {
  state: PhysicsObjectsState;
  terrain: TerrainGrid;
  timeSeconds: number;
  nowMs: number;
  zoom: number;
}

export function createPhysicsObjectsView(): PhysicsObjectsView {
  const shadows = createContactShadowLayer("object shadows");
  const balls = new Container({ label: "physics objects" });
  const overlay = new Graphics({ label: "physics object states" });
  const container = new Container({ label: "physics objects layer" });
  container.addChild(shadows.container, balls, overlay);
  return { container, shadows, balls, sprites: new Map(), overlay };
}

type Ball = PhysicsObject & { body: BallBodySpec };

/** One ball: an outer container (position, squash) holding the turning panels and the fixed gloss. */
function buildBall(object: Ball, outline: number): Container {
  const r = object.radius;
  const outer = new Container();
  const panels = new Graphics();
  const colors = object.body.panels.map((key) => GAME_PALETTE.objectPanels[key]);
  // The silhouette line blobs use (shared `inkStroke`, owner: consistent with other outlines).
  panels.circle(0, 0, r).stroke(inkStroke(outline));
  const wedge = (Math.PI * 2) / Math.max(1, colors.length);
  colors.forEach((color, i) => {
    panels
      .moveTo(0, 0)
      .arc(0, 0, r, i * wedge, (i + 1) * wedge)
      .closePath()
      .fill(color);
  });
  panels.circle(0, 0, r * HUB).fill(GAME_PALETTE.objectPanels.cream);
  panels.position.set(0, -r);
  const gloss = new Graphics()
    .ellipse(-r * 0.38, -r * 1.42, r * 0.22, r * 0.12)
    .fill({ color: GAME_PALETTE.gloss, alpha: 0.75 });
  outer.addChild(panels, gloss);
  return outer;
}

function latestMoment(
  state: PhysicsObjectsState,
  object: PhysicsObject,
  kind: ObjectMoment["kind"]
): ObjectMoment | null {
  for (let i = state.moments.length - 1; i >= 0; i -= 1) {
    const moment = state.moments[i]!;
    if (moment.objectId === object.id && moment.kind === kind) return moment;
  }
  return null;
}

/** Squash wide on a bounce (by its strength), recovering over `SQUASH_SECONDS`; pop-in after coming back. */
function placeBall(sprite: Container, object: PhysicsObject, frame: PhysicsObjectsFrame): void {
  sprite.position.set(object.x, object.y + object.radius);
  const panels = sprite.children[0];
  if (panels) panels.rotation = object.angle;
  const bounce = latestMoment(frame.state, object, "bounce");
  const since = bounce ? frame.timeSeconds - bounce.atSeconds : Infinity;
  const k = since < SQUASH_SECONDS ? (1 - since / SQUASH_SECONDS) * bounce!.strength : 0;
  const sx = 1 + BOUNCE_WIDEN * k;
  const back = latestMoment(frame.state, object, "back");
  const grow = back ? popInScale((frame.timeSeconds - back.atSeconds) / EFFECT_SECONDS) : 1;
  sprite.scale.set(sx * grow, (1 / sx) * grow);
}

/** Flame tongues around the whole ball, flickering. */
function drawFlames(g: Graphics, object: PhysicsObject, nowMs: number): void {
  const { outer, mid, core } = GAME_PALETTE.fire;
  const r = object.radius;
  for (let i = 0; i < FLAMES; i += 1) {
    const angle = -Math.PI / 2 + ((i - (FLAMES - 1) / 2) / FLAMES) * Math.PI * 1.6;
    const flicker = 0.75 + 0.25 * Math.sin(nowMs / 70 + i * 1.7);
    const length = r * 0.7 * flicker;
    const baseX = object.x + Math.cos(angle) * r * 0.85;
    const baseY = object.y + Math.sin(angle) * r * 0.85;
    // Flames rise world-up whatever the side they start on.
    g.ellipse(baseX, baseY - length * 0.4, r * 0.22, length * 0.6).fill({
      color: outer,
      alpha: 0.9,
    });
    g.ellipse(baseX, baseY - length * 0.3, r * 0.13, length * 0.4).fill({
      color: mid,
      alpha: 0.95,
    });
    g.ellipse(baseX, baseY - length * 0.2, r * 0.06, length * 0.22).fill(core);
  }
}

/** A frost disc over the ball with a white gloss streak. */
function drawFrost(g: Graphics, object: PhysicsObject): void {
  const r = object.radius;
  g.circle(object.x, object.y, r * 1.12).fill({ color: GAME_PALETTE.ice.body, alpha: 0.55 });
  g.circle(object.x, object.y, r * 1.12).stroke({
    width: 1.5,
    color: GAME_PALETTE.ice.lip,
    alpha: 0.9,
  });
  g.moveTo(object.x - r * 0.6, object.y - r * 0.1)
    .lineTo(object.x - r * 0.1, object.y - r * 0.6)
    .stroke({ width: Math.max(1.5, r * 0.12), color: GAME_PALETTE.iceGloss, alpha: 0.7 });
}

/** Smoke rings of recent pops and come-backs. */
function drawRings(g: Graphics, frame: PhysicsObjectsFrame): void {
  for (const moment of frame.state.moments) {
    if (moment.kind !== "pop" && moment.kind !== "back") continue;
    const t = (frame.timeSeconds - moment.atSeconds) / EFFECT_SECONDS;
    if (t < 0 || t >= 1) continue;
    const object = frame.state.objects.find((candidate) => candidate.id === moment.objectId);
    const r = (object?.radius ?? 16) * (0.8 + 0.8 * t);
    g.circle(moment.at.x, moment.at.y, r).stroke({
      width: 3 * (1 - t) + 1,
      color: GAME_PALETTE.smoke,
      alpha: 0.85 * (1 - t),
    });
  }
}

/** A ball in play (a kart's wheels are drawn by the karts feature). */
const isBall = (object: PhysicsObject): object is Ball =>
  object.goneUntil === null && object.body.shape === "ball";

export function syncPhysicsObjectsView(view: PhysicsObjectsView, frame: PhysicsObjectsFrame): void {
  const inPlay = frame.state.objects.filter(isBall);
  // A ball is a round body beside the blobs: the character width, as blobs and terrain have.
  const outline = outlineWidth("character", frame.zoom);
  syncDisplayById(view.sprites, view.balls, {
    list: inPlay,
    key: (object) => `${object.id}:${outline.step}`,
    create: (object) => buildBall(object, outline.width),
    place: (sprite, object) => placeBall(sprite, object, frame),
  });
  syncContactShadows(view.shadows, {
    casters: inPlay
      .filter((object) => !object.grounded)
      .map((object) => ({
        key: object.id,
        x: object.x,
        y: object.y + object.radius,
        width: object.radius * 2,
      })),
    groundBelow: (span) => surfaceBelow(frame.terrain, span),
  });
  const g = view.overlay;
  g.clear();
  for (const object of inPlay) {
    if (object.state.kind === "burning") drawFlames(g, object, frame.nowMs);
    else if (object.state.kind === "frozen") drawFrost(g, object);
  }
  drawRings(g, frame);
}
