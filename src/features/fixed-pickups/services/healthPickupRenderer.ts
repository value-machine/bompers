import { Container, Graphics } from "pixi.js";
import { GAME_PALETTE } from "@/shared/config/gamePalette";
import { drawInkHeart } from "@/shared/services/heartRenderer";
import { easeOutQuad } from "@/shared/utils/easing";
import { inkStroke, type OutlineWidth } from "@/shared/utils/outlineWidth";
import {
  fixedPickupBob,
  fixedPickupPhase,
  type PlaceFixedPickupArgs,
} from "@/features/fixed-pickups/services/fixedPickupPhase";
import type { FixedPickup } from "@/features/fixed-pickups/types/fixedPickups.types";

/**
 * Health pickup look (owner, health-pickups D1: option A "Heart jelly" as a hard jelly candy;
 * DESIGN_LANGUAGE § 1 Effects, GAME_JUICE § 6): a firm cherry candy heart with the shared ink
 * line, a lighter cherry glow where light shows through it, a crisp white highlight and a cream
 * plus. It barely deforms: a stiff squash of 1.5 % at the bottom of its bob, no wobble. When
 * taken it snaps into candy shards and mini hearts with a cherry ring; while gone a faint heart
 * regrows on its point; when it is back it pops in. All derived from sim state, render only.
 */
export const HEALTH_PICKUP_LOOK = {
  /** Heart box as a share of the touch box (30 → 22 × 20, under the blob's 28). */
  widthFraction: 0.74,
  heightFraction: 0.66,
  bob: { amplitude: 2.5, periodMs: 1000 },
  /** Stiff squash at the bottom of the bob: sx = 1 + amount, sy = 1 / sx (GAME_JUICE § 4). */
  squash: 0.015,
  /** Pop-in on return, seconds (GAME_JUICE `squash` window). */
  popInSeconds: 0.15,
  /** Shards flying off when taken, seconds (GAME_JUICE `linger` window). */
  popSeconds: 0.32,
  /** Pieces when it cracks: shards and mini hearts in turn. */
  shards: 6,
  /** Regrowing ghost: scale at the start and end of the respawn. */
  regrow: { from: 0.2, to: 0.95, alpha: 0.4 },
} as const;

/** The candy's stiff idle pose: a tiny squash only at the bottom of the bob. */
export function healthPickupPose(nowMs: number, pointIndex: number): { sx: number; sy: number } {
  const { periodMs } = HEALTH_PICKUP_LOOK.bob;
  const low = Math.max(0, Math.sin(((nowMs + pointIndex * 250) / periodMs) * Math.PI * 2));
  const k = 1 + HEALTH_PICKUP_LOOK.squash * low * low;
  return { sx: k, sy: 1 / k };
}

interface HealthSprite extends Container {
  candy: Container;
  ghost: Container;
  pop: Container;
  ring: Graphics;
  shards: Graphics[];
  w: number;
}

/** Cream plus, crisp, with a thin ink line. */
function drawPlus(s: number, width: number): Graphics {
  const t = s * 0.36;
  const plus = new Graphics()
    .roundRect(-s, -t, s * 2, t * 2, t * 0.4)
    .roundRect(-t, -s, t * 2, s * 2, t * 0.4);
  return plus.stroke(inkStroke(width * 0.6)).fill(GAME_PALETTE.healthPickup.plus);
}

function drawCandy(w: number, h: number, outline: OutlineWidth): Container {
  const { body, glow } = GAME_PALETTE.healthPickup;
  const candy = new Container();
  const heart = drawInkHeart(new Graphics(), {
    x: 0,
    y: 0,
    w,
    h,
    fill: body,
    outline: outline.width,
  });
  const light = drawInkHeart(new Graphics(), {
    x: w * 0.1,
    y: h * 0.14,
    w: w * 0.55,
    h: h * 0.5,
    fill: glow,
    outline: 0,
  });
  light.alpha = 0.55;
  const plus = drawPlus(w * 0.17, outline.width);
  plus.position.set(0, -h * 0.02);
  const highlight = new Graphics()
    .ellipse(-w * 0.24, -h * 0.24, w * 0.11, h * 0.06)
    .fill(GAME_PALETTE.gloss)
    .circle(-w * 0.07, -h * 0.33, w * 0.03)
    .fill(GAME_PALETTE.gloss);
  highlight.rotation = -0.5;
  candy.addChild(heart, light, plus, highlight);
  return candy;
}

/** A candy shard (a triangle) or a mini heart, cherry with the ink line. */
function drawShard(i: number, w: number, outline: OutlineWidth): Graphics {
  const { body } = GAME_PALETTE.healthPickup;
  if (i % 2 === 1) {
    return drawInkHeart(new Graphics(), {
      x: 0,
      y: 0,
      w: w * 0.3,
      h: w * 0.27,
      fill: body,
      outline: outline.width * 0.7,
    });
  }
  const s = w * 0.16;
  const tri = [-s, s * 0.7, s * 0.9, s * 0.4, -s * 0.1, -s];
  return new Graphics()
    .poly(tri)
    .stroke(inkStroke(outline.width * 0.7))
    .poly(tri)
    .fill(body);
}

/** The candy, its crack (ring + shards) and the regrowing ghost; children: ghost, pop, candy. */
export function drawHealthPickup(size: number, outline: OutlineWidth): Container {
  const w = size * HEALTH_PICKUP_LOOK.widthFraction;
  const h = size * HEALTH_PICKUP_LOOK.heightFraction;
  const ghost = drawInkHeart(new Graphics(), {
    x: 0,
    y: 0,
    w,
    h,
    fill: GAME_PALETTE.healthPickup.body,
    outline: outline.width,
  });
  ghost.alpha = HEALTH_PICKUP_LOOK.regrow.alpha;
  const ring = new Graphics()
    .circle(0, 0, w / 2)
    .stroke({ width: outline.width, color: GAME_PALETTE.healthPickup.body });
  const shards = Array.from({ length: HEALTH_PICKUP_LOOK.shards }, (_, i) =>
    drawShard(i, w, outline)
  );
  const pop = new Container();
  pop.addChild(ring, ...shards);
  const candy = drawCandy(w, h, outline);
  const root = new Container() as HealthSprite;
  root.addChild(ghost, pop, candy);
  return Object.assign(root, { candy, ghost, pop, ring, shards, w });
}

/** Ring widens and fades; shards snap out, spin, fall and fade (a hard candy, not a splat). */
function placeCrack(sprite: HealthSprite, t: number): void {
  const r = sprite.w / 2;
  sprite.ring.scale.set(1 + t * 0.6);
  sprite.ring.alpha = 1 - t;
  const count = sprite.shards.length;
  sprite.shards.forEach((shard, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2 + 0.3;
    const distance = r * 0.4 + easeOutQuad(t) * r * 1.8;
    shard.position.set(Math.cos(angle) * distance, Math.sin(angle) * distance + t * t * r * 1.2);
    shard.rotation = (i % 2 === 0 ? 1 : -1) * t * 4;
    shard.alpha = 1 - t * 0.8;
  });
}

export function placeHealthPickup(
  container: Container,
  pickup: FixedPickup,
  args: PlaceFixedPickupArgs
): void {
  const sprite = container as HealthSprite;
  const phase = fixedPickupPhase(pickup, { ...args, timing: HEALTH_PICKUP_LOOK });
  sprite.candy.visible = phase.kind === "present";
  sprite.pop.visible = phase.kind === "popping";
  sprite.ghost.visible = phase.kind === "regrowing";
  const bob =
    phase.kind === "present" ? fixedPickupBob(HEALTH_PICKUP_LOOK.bob, { ...args, ...pickup }) : 0;
  sprite.position.set(pickup.x, pickup.y + bob);
  if (phase.kind === "present") {
    const { sx, sy } = healthPickupPose(args.nowMs, pickup.pointIndex);
    sprite.candy.scale.set(sx * phase.popIn, sy * phase.popIn);
  } else if (phase.kind === "popping") {
    placeCrack(sprite, phase.t);
  } else {
    sprite.ghost.scale.set(phase.grow);
  }
}
