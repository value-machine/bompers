import { Container, Graphics } from "pixi.js";
import { GAME_PALETTE } from "@/shared/config/gamePalette";
import { inkStroke, outlineWidth } from "@/shared/utils/outlineWidth";
import { popInScale } from "@/shared/utils/easing";
import { syncDisplayById } from "@/shared/utils/displaySync";
import type { PhysicsObjectsState } from "@/features/physics-objects/api/physicsObjectsApi";
import { chassisOf, wheelRadiusOf } from "@/features/karts/services/kartBody";
import { kartInPlay } from "@/features/karts/services/kartSeats";
import type { Kart, KartsState } from "@/features/karts/services/kartModel";

/**
 * The kart layer (owner, kart Q1: a low open go-kart, the driver seen sitting in it). Drawn above
 * the blobs, so a seated driver's lower half sits inside the tub. Two tyres with a turning hub,
 * a rounded tub in the variant's body colour with a trim stripe and a seat back, one ink outline
 * (the character width, like blobs and balls). Juice (GAME_JUICE ledger, render only): the chassis
 * squashes with its spring (volume kept, inside the JUICE band) — sinking when someone gets in or
 * it lands, stretching when it hops — pops in when it comes back (`effect` window), and burns or
 * freezes as a whole (flames all along, a frost sheet).
 */

/** Strongest spring squash: width × (1 + this) at full travel, height ÷ the same. */
const SPRING_WIDEN = 0.14;
/** Pop-in on coming back (seconds), inside `JUICE_WINDOWS.effect`. */
const EFFECT_SECONDS = 0.22;
/** Flame tongues along a burning kart. */
const FLAMES = 6;

/** The juice numbers, for the scale check (`kartRenderer.test.ts`). */
export const KART_JUICE = { SPRING_WIDEN, EFFECT_SECONDS } as const;

export interface KartsView {
  container: Container;
  sprites: Map<string, Container>;
  overlay: Graphics;
}

export interface KartsFrame {
  karts: KartsState;
  physics: PhysicsObjectsState;
  timeSeconds: number;
  nowMs: number;
  zoom: number;
  /** The tunables' spring travel (× kart height), for the squash. */
  springTravel: number;
}

export function createKartsView(): KartsView {
  const container = new Container({ label: "karts layer" });
  const overlay = new Graphics({ label: "kart states" });
  const sprites = new Map<string, Container>();
  const bodies = new Container({ label: "karts" });
  container.addChild(bodies, overlay);
  return { container, sprites, overlay };
}

function buildTyre(radius: number, outline: number): Graphics {
  const g = new Graphics();
  g.circle(0, 0, radius).fill(GAME_PALETTE.ink).stroke(inkStroke(outline));
  g.circle(0, 0, radius * 0.45).fill(GAME_PALETTE.objectPanels.cream);
  g.rect(-radius * 0.1, -radius * 0.42, radius * 0.2, radius * 0.84).fill(GAME_PALETTE.ink);
  return g;
}

/** The tub, drawn level around (0, 0); placed, turned and squashed each frame. */
function buildChassis(kart: Kart, outline: number): Graphics {
  const { halfLength, radius } = chassisOf(kart);
  const body = GAME_PALETTE.objectPanels[kart.body.body];
  const trim = GAME_PALETTE.objectPanels[kart.body.trim];
  const w = (halfLength + radius) * 2;
  const g = new Graphics();
  g.roundRect(-w / 2, -radius, w, radius * 2, radius)
    .fill(body)
    .stroke(inkStroke(outline));
  g.roundRect(
    -w / 2 + radius * 0.6,
    -radius * 0.2,
    w - radius * 1.2,
    radius * 0.45,
    radius * 0.2
  ).fill(trim);
  g.ellipse(-w * 0.22, -radius * 0.55, radius * 0.5, radius * 0.18).fill({
    color: GAME_PALETTE.gloss,
    alpha: 0.6,
  });
  return g;
}

function buildKart(kart: Kart, outline: number): Container {
  const sprite = new Container();
  const r = wheelRadiusOf(kart);
  sprite.addChild(buildTyre(r, outline), buildTyre(r, outline), buildChassis(kart, outline));
  return sprite;
}

/** Latest moment of the kart's own or one of its wheels' kind. */
function latestAt(frame: KartsFrame, ids: readonly string[], kind: string): number {
  for (let i = frame.physics.moments.length - 1; i >= 0; i -= 1) {
    const moment = frame.physics.moments[i]!;
    if (moment.kind === kind && ids.includes(moment.objectId)) return moment.atSeconds;
  }
  return -Infinity;
}

function placeKart(sprite: Container, kart: Kart, frame: KartsFrame): void {
  const [left, right, tub] = sprite.children;
  kart.wheels.forEach((wheel, i) => {
    const tyre = i === 0 ? left : right;
    tyre?.position.set(wheel.x, wheel.y);
    if (tyre) tyre.rotation = wheel.angle;
  });
  if (!tub) return;
  const chassis = chassisOf(kart);
  tub.position.set(chassis.center.x, chassis.center.y);
  tub.rotation = Math.atan2(chassis.along.y, chassis.along.x);
  // Sinking on the spring (offset against up) widens it; lifting stretches it.
  const sink = -(kart.spring.x * chassis.up.x + kart.spring.y * chassis.up.y);
  const k = Math.max(-1, Math.min(1, sink / Math.max(1e-6, frame.springTravel * kart.height)));
  const ids = kart.wheels.map((wheel) => wheel.id);
  const back = latestAt(frame, ids, "back");
  const grow = popInScale((frame.timeSeconds - back) / EFFECT_SECONDS);
  const sx = 1 + SPRING_WIDEN * k;
  sprite.scale.set(1);
  tub.scale.set(sx * grow, (1 / sx) * grow);
}

/** Flame tongues all along the tub, flickering. */
function drawFlames(g: Graphics, kart: Kart, nowMs: number): void {
  const { outer, mid, core } = GAME_PALETTE.fire;
  const chassis = chassisOf(kart);
  const span = chassis.halfLength + chassis.radius;
  for (let i = 0; i < FLAMES; i += 1) {
    const t = (i / (FLAMES - 1)) * 2 - 1;
    const flicker = 0.75 + 0.25 * Math.sin(nowMs / 70 + i * 1.7);
    const length = chassis.radius * 2.2 * flicker;
    const x = chassis.center.x + chassis.along.x * span * t * 0.9;
    const y = chassis.center.y + chassis.along.y * span * t * 0.9 - chassis.radius;
    g.ellipse(x, y - length * 0.4, chassis.radius * 0.6, length * 0.6).fill({
      color: outer,
      alpha: 0.9,
    });
    g.ellipse(x, y - length * 0.3, chassis.radius * 0.35, length * 0.4).fill({
      color: mid,
      alpha: 0.95,
    });
    g.ellipse(x, y - length * 0.2, chassis.radius * 0.16, length * 0.22).fill(core);
  }
}

/** A frost sheet over the tub and wheels. */
function drawFrost(g: Graphics, kart: Kart): void {
  const chassis = chassisOf(kart);
  const w = (chassis.halfLength + chassis.radius) * 2 + 6;
  const top = chassis.center.y - chassis.radius - 3;
  const bottom = Math.max(...kart.wheels.map((wheel) => wheel.y)) + wheelRadiusOf(kart) + 3;
  g.roundRect(chassis.center.x - w / 2, top, w, bottom - top, 6).fill({
    color: GAME_PALETTE.ice.body,
    alpha: 0.55,
  });
  g.roundRect(chassis.center.x - w / 2, top, w, bottom - top, 6).stroke({
    width: 1.5,
    color: GAME_PALETTE.ice.lip,
    alpha: 0.9,
  });
}

export function syncKartsView(view: KartsView, frame: KartsFrame): void {
  const inPlay = frame.karts.karts.filter(kartInPlay);
  const outline = outlineWidth("character", frame.zoom);
  const bodies = view.container.children[0] as Container;
  syncDisplayById(view.sprites, bodies, {
    list: inPlay,
    key: (kart) => `${kart.id}:${outline.step}`,
    create: (kart) => buildKart(kart, outline.width),
    place: (sprite, kart) => placeKart(sprite, kart, frame),
  });
  const g = view.overlay;
  g.clear();
  for (const kart of inPlay) {
    if (kart.state.kind === "burning") drawFlames(g, kart, frame.nowMs);
    else if (kart.state.kind === "frozen") drawFrost(g, kart);
  }
}
