import { Container, Graphics } from "pixi.js";
import { GAME_PALETTE } from "@/shared/config/gamePalette";
import {
  createContactShadowLayer,
  syncContactShadows,
  type ContactShadowLayer,
} from "@/shared/utils/contactShadowLayer";
import { syncDisplayById } from "@/shared/utils/displaySync";
import { DESIGN_SCALE, outlineWidth } from "@/shared/utils/outlineWidth";
import { surfaceBelow, type TerrainGrid } from "@/features/arena/api/arenaApi";
import type { PlayerState } from "@/features/player/api/playerApi";
import type { CombatState, RocketState } from "@/features/combat/types/combat.types";

/**
 * Combat render layers (DESIGN_LANGUAGE § 1 Effects, § 4 shadows, § 5 draw order). The match
 * renderer places them: shadows (4, contact shadows of rockets) → [weapon crates (5), the
 * `collectibles` feature] → [effects (6), the `effects` feature] → rockets (7, with smoke trail;
 * homing missiles: lilac hull, 6 Hz seeker light, a lilac trail that follows their curve)
 * → players (8, which wear the rocket tube while armed) → overlay (health chunks above each
 * player). Effects therefore never cover a player outline. Shapes follow mockup variant E at
 * `DESIGN_SCALE`; outlines use the zoom-clamped prop width. Sprites are drawn once; per frame
 * only transforms change, except the health pips, which redraw when a player's health changes.
 *
 * Not yet: hit flash, screen shake (motion polish follow-up).
 */
export interface CombatView {
  shadows: ContactShadowLayer;
  rockets: Container;
  overlay: Container;
  rocketSprites: Map<number, Container>;
  health: Map<string, { pips: Graphics; shown: number }>;
}

const PIP = { w: 6, h: 5, gap: 2, lift: 10 };
const S = DESIGN_SCALE;
/** Rocket length (mockup 25 + nose) for its contact shadow. */
const ROCKET_LENGTH = 32 * S;
/** Smoke puffs behind a rocket: one more appears every this many seconds of flight. */
const PUFF_SECONDS = 0.012;

const ink = (width: number) => ({ width, color: GAME_PALETTE.ink, join: "round" as const });
const slotColor = (slot: number): number =>
  GAME_PALETTE.players[slot % GAME_PALETTE.players.length] ?? GAME_PALETTE.ink;

export function createCombatView(): CombatView {
  return {
    shadows: createContactShadowLayer("contact-shadows"),
    rockets: new Container({ label: "rockets" }),
    overlay: new Container({ label: "combat-overlay" }),
    rocketSprites: new Map(),
    health: new Map(),
  };
}

/** White smoke puffs trailing the rocket (mockup variant E), fading with distance. */
function drawTrail(): Container {
  const trail = new Container();
  for (let i = 1; i <= 5; i += 1) {
    trail.addChild(
      new Graphics()
        .circle(-(16 + i * 17) * S, Math.sin(i * 1.7) * 3 * S, (5 + i * 1.8) * S)
        .fill({ color: GAME_PALETTE.smoke, alpha: 0.9 - i * 0.14 })
    );
  }
  return trail;
}

/** Mockup variant E rocket: nose along +x, fins and band in the shooter's colour, flame behind. */
function drawRocket(rocket: RocketState, width: number): Container {
  const { body, nose, flame } = GAME_PALETTE.rocket;
  const fin = slotColor(rocket.ownerSlot);
  const root = new Container();
  const shape = new Graphics()
    .circle(-14 * S, 0, 6.5 * S)
    .fill(flame)
    .poly([-10 * S, -7 * S, -17 * S, -12 * S, -6 * S, -6 * S])
    .poly([-10 * S, 7 * S, -17 * S, 12 * S, -6 * S, 6 * S])
    .fill(fin)
    .stroke(ink(width))
    .roundRect(-12 * S, -6.5 * S, 25 * S, 13 * S, 6.5 * S)
    .fill(body)
    .stroke(ink(width))
    .moveTo(9 * S, -6.5 * S)
    .quadraticCurveTo(20 * S, 0, 9 * S, 6.5 * S)
    .closePath()
    .fill(nose)
    .stroke(ink(width))
    .rect(-5 * S, -6.5 * S, 4 * S, 13 * S)
    .fill(fin);
  root.addChild(drawTrail(), shape);
  return root;
}

/** Homing trail: positions kept per sprite (newest last), so the lilac puffs follow the curve. */
const homingTrails = new WeakMap<Container, { x: number; y: number }[]>();
const HOMING_TRAIL = { points: 12, spacing: 7 * S, blinkHz: 6 };

/**
 * Homing missile (weapon-visuals spec): shorter, rounder lilac hull, fins in the shooter's colour,
 * a red seeker light on the nose (child 1, blinks at 6 Hz). The sprite is a world-space root:
 * child 0 the trail (drawn in world coordinates), child 1 the body (placed and rotated).
 */
function drawHomingMissile(rocket: RocketState, width: number): Container {
  const { body, seeker } = GAME_PALETTE.homing;
  const fin = slotColor(rocket.ownerSlot);
  const hull = new Container();
  const shape = new Graphics()
    .circle(-10 * S, 0, 5 * S)
    .fill(GAME_PALETTE.rocket.flame)
    .poly([-5 * S, -6 * S, -12 * S, -11 * S, -2 * S, -6 * S])
    .poly([-5 * S, 6 * S, -12 * S, 11 * S, -2 * S, 6 * S])
    .fill(fin)
    .stroke(ink(width))
    .roundRect(-8 * S, -7 * S, 18 * S, 14 * S, 7 * S)
    .fill(body)
    .stroke(ink(width));
  const light = new Graphics().circle(7 * S, 0, 3 * S).fill(seeker);
  hull.addChild(shape, light);
  const root = new Container();
  root.addChild(new Graphics(), hull);
  homingTrails.set(root, []);
  return root;
}

function drawHomingTrail(trail: Graphics, points: readonly { x: number; y: number }[]): void {
  trail.clear();
  const count = points.length;
  points.forEach((point, i) => {
    const fromHead = count - i;
    trail
      .circle(point.x, point.y, (3 + fromHead * 0.9) * S)
      .fill({ color: GAME_PALETTE.homing.trail, alpha: Math.max(0, 0.85 - fromHead * 0.065) });
  });
}

function placeHomingMissile(sprite: Container, rocket: RocketState): void {
  const [trail, hull] = sprite.children;
  if (!(trail instanceof Graphics) || !hull) return;
  hull.position.set(rocket.x, rocket.y);
  hull.rotation = Math.atan2(rocket.dirY, rocket.dirX);
  const light = hull.children[1];
  if (light) light.visible = (rocket.age * HOMING_TRAIL.blinkHz) % 1 < 0.5;
  const points = homingTrails.get(sprite) ?? [];
  const last = points[points.length - 1];
  if (!last || Math.hypot(rocket.x - last.x, rocket.y - last.y) >= HOMING_TRAIL.spacing) {
    points.push({ x: rocket.x, y: rocket.y });
    if (points.length > HOMING_TRAIL.points) points.shift();
  }
  // The newest puff sits behind the tail, not on the hull.
  drawHomingTrail(trail, points.slice(0, -1));
}

function placeRocket(sprite: Container, rocket: RocketState): void {
  if (rocket.kind === "homing") {
    placeHomingMissile(sprite, rocket);
    return;
  }
  sprite.position.set(rocket.x, rocket.y);
  sprite.rotation = Math.atan2(rocket.dirY, rocket.dirX);
  const trail = sprite.children[0];
  const shown = Math.floor(rocket.age / PUFF_SECONDS);
  trail?.children.forEach((puff, i) => {
    puff.visible = i < shown;
  });
}

interface PipsLook {
  health: number;
  slot: number;
  max: number;
}

function drawPips(pips: Graphics, { health, slot, max }: PipsLook): void {
  const total = max * PIP.w + (max - 1) * PIP.gap;
  pips.clear();
  for (let i = 0; i < max; i += 1) {
    pips
      .roundRect(-total / 2 + i * (PIP.w + PIP.gap), 0, PIP.w, PIP.h, 2)
      .fill(i < health ? slotColor(slot) : GAME_PALETTE.healthLost)
      .stroke(ink(1.2));
  }
}

function syncPlayerExtras(view: CombatView, frame: CombatFrame): void {
  const { combat, players, maxHealth } = frame;
  for (const player of players) {
    const fighter = combat.fighters.get(player.id);
    if (!fighter) continue;
    let bar = view.health.get(player.id);
    if (!bar) {
      bar = { pips: new Graphics(), shown: -1 };
      view.health.set(player.id, bar);
      view.overlay.addChild(bar.pips);
    }
    if (bar.shown !== fighter.health)
      drawPips(bar.pips, { health: fighter.health, slot: player.slot, max: maxHealth });
    bar.shown = fighter.health;
    bar.pips.visible = !fighter.eliminated;
    bar.pips.position.set(player.x, player.y - player.height - PIP.lift - PIP.h);
  }
}

/** Rockets cast a contact shadow on the first surface below (§ 4). */
function syncShadows(view: CombatView, frame: CombatFrame): void {
  syncContactShadows(view.shadows, {
    casters: frame.combat.rockets.map((rocket) => ({
      key: `r${rocket.id}`,
      x: rocket.x,
      y: rocket.y,
      width: ROCKET_LENGTH,
    })),
    groundBelow: (span) => surfaceBelow(frame.terrain, span),
  });
}

export interface CombatFrame {
  combat: CombatState;
  players: readonly PlayerState[];
  /** Sim time of the state being drawn, seconds. */
  timeSeconds: number;
  maxHealth: number;
  /** Terrain the contact shadows fall on. */
  terrain: TerrainGrid;
  /** Camera zoom (screen px per world unit) for the outline width clamp. */
  zoom: number;
}

/** Matches the combat layers to the state. Call once per rendered frame. */
export function syncCombatView(view: CombatView, frame: CombatFrame): void {
  const { combat, zoom } = frame;
  const width = outlineWidth("prop", zoom);
  syncDisplayById(view.rocketSprites, view.rockets, {
    list: combat.rockets,
    key: (rocket) => rocket.id,
    create: (rocket) =>
      rocket.kind === "homing"
        ? drawHomingMissile(rocket, width.width)
        : drawRocket(rocket, width.width),
    place: placeRocket,
  });
  syncShadows(view, frame);
  syncPlayerExtras(view, frame);
}
