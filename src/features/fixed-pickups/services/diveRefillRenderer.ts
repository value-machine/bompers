import { Container, Graphics } from "pixi.js";
import { GAME_PALETTE } from "@/shared/config/gamePalette";
import { easeOutQuad } from "@/shared/utils/easing";
import type { OutlineWidth } from "@/shared/utils/outlineWidth";
import {
  fixedPickupBob,
  fixedPickupPhase,
  type PlaceFixedPickupArgs,
} from "@/features/fixed-pickups/services/fixedPickupPhase";
import type { FixedPickup } from "@/features/fixed-pickups/types/fixedPickups.types";

/**
 * Headbutt reset look (owner, dive-reset-bubble: option C "Jelly bubble"; DESIGN_LANGUAGE § 1
 * Effects, GAME_JUICE § 6): an aqua jelly bubble with the prop ink outline, a white gloss arc and a
 * cream headbutt glyph (helmet dome + speed lines) inside. It is a little smaller than a blob and
 * has no eyes, helmet or feet, so it does not read as a player. While present it bobs and wobbles;
 * when taken it pops into droplets and a ring; while gone a faint bubble regrows on the point; when
 * it is back it pops in. All derived from sim state, render only.
 */
export const DIVE_REFILL_LOOK = {
  /** Bubble radius as a share of the touch box (30 → 12.6, under the blob's 14). */
  radiusFraction: 0.42,
  bob: { amplitude: 2.5, periodMs: 1000 },
  /** Idle jelly wobble: sx = 1 + amount · sin, sy = 1 / sx (volume kept, GAME_JUICE § 4). */
  wobble: { amount: 0.04, periodMs: 1100 },
  /** Pop-in on return, seconds (GAME_JUICE `squash` window). */
  popInSeconds: 0.15,
  /** Droplets flying off when taken, seconds (GAME_JUICE `linger` window). */
  popSeconds: 0.32,
  droplets: 6,
  /** Regrowing ghost: radius share at the start and end of the respawn. */
  regrow: { from: 0.2, to: 0.95, fillAlpha: 0.4, inkAlpha: 0.35 },
} as const;

/** Idle wobble pose; each point is offset so neighbours do not wobble in step. */
export function diveRefillWobble(nowMs: number, pointIndex: number): { sx: number; sy: number } {
  const { amount, periodMs } = DIVE_REFILL_LOOK.wobble;
  const k = 1 + amount * Math.sin(((nowMs + pointIndex * 250) / periodMs) * Math.PI * 2);
  return { sx: k, sy: 1 / k };
}

interface RefillSprite extends Container {
  bubble: Container;
  ghost: Graphics;
  pop: Container;
  ring: Graphics;
  droplets: Graphics[];
  radius: number;
}

/** Headbutt glyph: a cream helmet dome facing the dash, three ink speed lines behind it. */
function drawGlyph(s: number, width: number): Graphics {
  const ink = { width, color: GAME_PALETTE.ink, join: "round" as const, cap: "round" as const };
  const glyph = new Graphics()
    .moveTo(-s * 0.05, -s * 0.55)
    .arc(-s * 0.05, 0, s * 0.55, -Math.PI / 2, Math.PI / 2)
    .closePath()
    .fill(GAME_PALETTE.helmet)
    .stroke(ink);
  for (const [y, length] of [
    [-0.32, 0.42],
    [0, 0.6],
    [0.32, 0.42],
  ] as const) {
    glyph
      .moveTo(-s * 0.28, y * s)
      .lineTo(-s * (0.28 + length), y * s)
      .stroke(ink);
  }
  return glyph;
}

function drawBubble(r: number, outline: OutlineWidth): Container {
  const bubble = new Container();
  bubble.addChild(
    new Graphics()
      .circle(0, 0, r)
      .fill(GAME_PALETTE.diveRefill)
      .stroke({ width: outline.width, color: GAME_PALETTE.ink }),
    new Graphics()
      .arc(0, 0, r * 0.72, Math.PI * 1.08, Math.PI * 1.45)
      .stroke({ width: outline.width * 1.4, color: GAME_PALETTE.gloss, cap: "round" }),
    new Graphics().circle(-r * 0.25, -r * 0.72, r * 0.07).fill(GAME_PALETTE.gloss),
    drawGlyph(r * 0.5, outline.width * 0.85)
  );
  return bubble;
}

/** The bubble, its pop (ring + droplets) and the regrowing ghost; children: ghost, pop, bubble. */
export function drawDiveRefill(size: number, outline: OutlineWidth): Container {
  const r = size * DIVE_REFILL_LOOK.radiusFraction;
  const { fillAlpha, inkAlpha } = DIVE_REFILL_LOOK.regrow;
  const ghost = new Graphics()
    .circle(0, 0, r)
    .fill({ color: GAME_PALETTE.diveRefill, alpha: fillAlpha })
    .stroke({ width: outline.width, color: GAME_PALETTE.ink, alpha: inkAlpha });
  const ring = new Graphics()
    .circle(0, 0, r)
    .stroke({ width: outline.width, color: GAME_PALETTE.diveRefill });
  const droplets = Array.from({ length: DIVE_REFILL_LOOK.droplets }, () =>
    new Graphics()
      .circle(0, 0, r * 0.22)
      .fill(GAME_PALETTE.diveRefill)
      .stroke({ width: outline.width * 0.7, color: GAME_PALETTE.ink })
  );
  const pop = new Container();
  pop.addChild(ring, ...droplets);
  const bubble = drawBubble(r, outline);
  const root = new Container() as RefillSprite;
  root.addChild(ghost, pop, bubble);
  return Object.assign(root, { bubble, ghost, pop, ring, droplets, radius: r });
}

/** Ring widens and fades; droplets fly out, fall a little and shrink. */
function placePop(sprite: RefillSprite, t: number): void {
  const r = sprite.radius;
  sprite.ring.scale.set(1 + t * 0.6);
  sprite.ring.alpha = 1 - t;
  const count = sprite.droplets.length;
  sprite.droplets.forEach((drop, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    const distance = r * 0.7 + easeOutQuad(t) * r * 1.5;
    drop.position.set(Math.cos(angle) * distance, Math.sin(angle) * distance + t * t * r * 0.6);
    drop.scale.set(1 - t * 0.5);
    drop.alpha = 1 - t * 0.7;
  });
}

export function placeDiveRefill(
  container: Container,
  pickup: FixedPickup,
  args: PlaceFixedPickupArgs
): void {
  const sprite = container as RefillSprite;
  const phase = fixedPickupPhase(pickup, { ...args, timing: DIVE_REFILL_LOOK });
  sprite.bubble.visible = phase.kind === "present";
  sprite.pop.visible = phase.kind === "popping";
  sprite.ghost.visible = phase.kind === "regrowing";
  const bob =
    phase.kind === "present" ? fixedPickupBob(DIVE_REFILL_LOOK.bob, { ...args, ...pickup }) : 0;
  sprite.position.set(pickup.x, pickup.y + bob);
  if (phase.kind === "present") {
    const { sx, sy } = diveRefillWobble(args.nowMs, pickup.pointIndex);
    sprite.bubble.scale.set(sx * phase.popIn, sy * phase.popIn);
  } else if (phase.kind === "popping") {
    placePop(sprite, phase.t);
  } else {
    sprite.ghost.scale.set(phase.grow);
  }
}
