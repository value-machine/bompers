import { Container, Graphics } from "pixi.js";
import { GAME_PALETTE, weaponLook } from "@/shared/config/gamePalette";
import type { GameTunables } from "@/shared/types/gameTunables.types";
import { starPoints } from "@/shared/utils/shapeGeometry";
import { createContactShadowLayer } from "@/shared/utils/contactShadowLayer";
import { syncDisplayById } from "@/shared/utils/displaySync";
import { easeOutQuad, popInScale, springBackPose } from "@/shared/utils/easing";
import { outlineWidth, type OutlineWidth } from "@/shared/utils/outlineWidth";
import type { TerrainGrid } from "@/features/arena/api/arenaApi";
import {
  syncCrateLayers,
  type CrateLayers,
} from "@/features/collectibles/services/weaponCrateRenderer";
import type {
  CollectiblesState,
  PickupBurst,
  PointOrb,
} from "@/features/collectibles/types/collectibles.types";
import {
  createDiveRefillLayer,
  syncDiveRefillLayer,
  type DiveRefillLayer,
} from "@/features/collectibles/services/diveRefillRenderer";

/**
 * Collectibles layers; the match renderer places them (DESIGN_LANGUAGE § 5): `shadows` (4,
 * contact shadows of falling weapon crates), `crates` (5, `weaponCrateRenderer.ts`), `orbs` (5,
 * point orbs), `bursts` (5, taken pickups). A point orb is a bubblegum star with an ink outline
 * (§ 1 Effects): it pops in where it appears, squashes wide when it reaches its point and springs
 * back, then bobs gently (GAME_JUICE § 6, `feel.pickup`). Drawn once per orb (and again when the
 * zoom-clamped prop outline width changes step); per frame only transforms change.
 */
export interface CollectiblesView extends CrateLayers {
  orbs: Container;
  orbSprites: Map<string, Container>;
  /** Headbutt resets (layer 5, beside the orbs): `diveRefillRenderer.ts`. */
  refills: DiveRefillLayer;
  /** Taken pickups bursting (layer 5, over the pickups). */
  bursts: Container;
  burstSprites: Map<string, Container>;
}

const BOB = { amplitude: 3, periodMs: 1200 };

export function createCollectiblesView(): CollectiblesView {
  return {
    shadows: createContactShadowLayer("crate-shadows"),
    crates: new Container({ label: "weapon-crates" }),
    crateSprites: new Map(),
    orbs: new Container({ label: "collectibles" }),
    orbSprites: new Map(),
    refills: createDiveRefillLayer(),
    bursts: new Container({ label: "pickup-bursts" }),
    burstSprites: new Map(),
  };
}

function drawOrb(size: number, width: number): Container {
  const root = new Container();
  const outer = size * 0.6;
  root.addChild(
    new Graphics()
      .poly(starPoints(5, outer, outer * 0.55))
      .fill(GAME_PALETTE.pointOrb)
      .stroke({ width, color: GAME_PALETTE.ink, join: "round" }),
    new Graphics()
      .circle(-outer * 0.15, -outer * 0.2, outer * 0.14)
      .fill({ color: GAME_PALETTE.gloss, alpha: 0.75 })
  );
  return root;
}

type PickupFeel = GameTunables["feel"]["pickup"];

/**
 * Pop-in while it appears, a wide squash springing back as it reaches its point, then the bob,
 * which starts from the rest height once the squash is over (no jump).
 */
function placeOrb(sprite: Container, orb: PointOrb, feel: PickupFeel): void {
  const pose = springBackPose(feel.settle, orb.restSeconds / feel.settle.seconds);
  const bobSeconds = Math.max(0, orb.restSeconds - feel.settle.seconds);
  const phase = ((bobSeconds * 1000) / BOB.periodMs) * Math.PI * 2;
  sprite.position.set(orb.x, orb.y + Math.sin(phase) * BOB.amplitude);
  const pop = popInScale(orb.ageSeconds / feel.popInSeconds);
  sprite.scale.set(pose.sx * pop, pose.sy * pop);
}

// --- Pickup bursts (GAME_JUICE § 6, pickup-juice D1–D3) ---
// Every taken pickup throws one ring in its colour; a point orb adds five mini stars flying out,
// a weapon crate four pieces flying off and falling. Light tier: no shake, no flash.

const SPARKS = 5;
/** How far the mini stars fly, in orb sizes. */
const SPARK_REACH = 1.6;
const PIECES = [
  { vx: -1, vy: -1.2, spin: -1 },
  { vx: 1, vy: -1.3, spin: 1 },
  { vx: -0.6, vy: -0.6, spin: 1 },
  { vx: 0.7, vy: -0.7, spin: -1 },
] as const;

interface BurstSprite extends Container {
  ring: Graphics;
  bits: Graphics[];
}

interface BurstLook {
  orbSize: number;
  crateSize: number;
  refillSize: number;
  outline: OutlineWidth;
}

function burstColor(itemId: PickupBurst["itemId"]): number {
  if (itemId === "point-orb") return GAME_PALETTE.pointOrb;
  if (itemId === "dive-reset") return GAME_PALETTE.diveRefill;
  return weaponLook(itemId).accent;
}

function burstSize(itemId: PickupBurst["itemId"], look: BurstLook): number {
  if (itemId === "point-orb") return look.orbSize;
  return itemId === "dive-reset" ? look.refillSize : look.crateSize;
}

function drawBits(itemId: PickupBurst["itemId"], look: BurstLook, color: number): Graphics[] {
  const ink = { width: look.outline.width * 0.6, color: GAME_PALETTE.ink, join: "round" as const };
  if (itemId === "dive-reset") return [];
  if (itemId === "point-orb") {
    const r = look.orbSize * 0.22;
    return Array.from({ length: SPARKS }, () =>
      new Graphics()
        .poly(starPoints(5, r, r * 0.55))
        .fill(color)
        .stroke(ink)
    );
  }
  const w = look.crateSize * 0.42;
  return PIECES.map(() =>
    new Graphics()
      .roundRect(-w / 2, -w * 0.4, w, w * 0.8, w * 0.15)
      .fill(color)
      .stroke(ink)
  );
}

function drawBurst(burst: PickupBurst, look: BurstLook): BurstSprite {
  const color = burstColor(burst.itemId);
  const ring = new Graphics()
    .circle(0, 0, burstSize(burst.itemId, look) * 0.55)
    .stroke({ width: look.outline.width * 1.5, color });
  const bits = drawBits(burst.itemId, look, color);
  const root = new Container() as BurstSprite;
  root.addChild(ring, ...bits);
  return Object.assign(root, { ring, bits });
}

/** The ring grows to double size and fades out over `ringSeconds`. */
function placeRing(ring: Graphics, t: number): void {
  ring.visible = t < 1;
  ring.scale.set(1 + t);
  ring.alpha = 1 - t;
}

/** Mini stars flying straight out, shrinking and fading. */
function placeSparks(bits: readonly Graphics[], t: number, size: number): void {
  const reach = size * (0.4 + SPARK_REACH * easeOutQuad(Math.min(1, t)));
  bits.forEach((bit, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / SPARKS;
    bit.visible = t < 1;
    bit.position.set(Math.cos(angle) * reach, Math.sin(angle) * reach);
    bit.rotation = t * 3;
    bit.scale.set(1 - t * 0.5);
    bit.alpha = 1 - t;
  });
}

/** Crate pieces thrown up and out, falling and spinning, fading over the last 30 %. */
function placePieces(bits: readonly Graphics[], t: number, size: number): void {
  bits.forEach((bit, index) => {
    const piece = PIECES[index] ?? PIECES[0];
    bit.visible = t < 1;
    bit.position.set(piece.vx * size * 2 * t, piece.vy * size * 2.4 * t + size * 4.5 * t * t);
    bit.rotation = piece.spin * t * 5;
    bit.alpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
  });
}

function placeBurst(sprite: BurstSprite, burst: PickupBurst, args: BurstFrame): void {
  const { itemId, ageSeconds } = burst;
  // A crate's burst comes out of its middle (crates stand on their bottom-centre).
  const crate = itemId !== "point-orb" && itemId !== "dive-reset";
  sprite.position.set(burst.x, burst.y - (crate ? args.crateSize / 2 : 0));
  placeRing(sprite.ring, ageSeconds / args.feel.ringSeconds);
  if (itemId === "point-orb")
    placeSparks(sprite.bits, ageSeconds / args.feel.sparkSeconds, args.orbSize);
  else placePieces(sprite.bits, ageSeconds / args.feel.pieceSeconds, args.crateSize);
}

interface BurstFrame extends BurstLook {
  feel: PickupFeel;
}

function syncBursts(
  view: CollectiblesView,
  bursts: readonly PickupBurst[],
  frame: BurstFrame
): void {
  syncDisplayById(view.burstSprites, view.bursts, {
    list: bursts,
    key: (burst) => `${burst.itemId}:${burst.id}:${frame.outline.step}`,
    create: (burst) => drawBurst(burst, frame),
    place: (sprite, burst) => placeBurst(sprite as BurstSprite, burst, frame),
  });
}

export interface CollectiblesFrame {
  collectibles: CollectiblesState;
  /** Point-orb touch box, world units. */
  size: number;
  /** Weapon-crate box, world units. */
  crateSize: number;
  /** Headbutt reset touch box and respawn time (`collectibles.diveRefill` tunables). */
  diveRefill: { size: number; respawnSeconds: number };
  /** Pickup juice timings and poses (`feel.pickup`). */
  feel: PickupFeel;
  /** Terrain the crate shadows fall on. */
  terrain: TerrainGrid;
  /** Animation clock, ms. */
  nowMs: number;
  /** Camera zoom (screen px per world unit) for the outline width clamp. */
  zoom: number;
}

/** Matches the layers to the current crates, orbs, resets and bursts. Call once per rendered frame. */
export function syncCollectiblesView(view: CollectiblesView, frame: CollectiblesFrame): void {
  const width = outlineWidth("prop", frame.zoom);
  const { feel } = frame;
  syncCrateLayers(view, {
    crates: frame.collectibles.crates.list,
    size: frame.crateSize,
    outline: width,
    terrain: frame.terrain,
    feel,
  });
  syncDiveRefillLayer(view.refills, {
    refills: frame.collectibles.diveRefills,
    size: frame.diveRefill.size,
    respawnSeconds: frame.diveRefill.respawnSeconds,
    popInSeconds: feel.popInSeconds,
    ringSeconds: feel.ringSeconds,
    outline: width,
    nowMs: frame.nowMs,
  });
  syncDisplayById(view.orbSprites, view.orbs, {
    list: frame.collectibles.orbs,
    key: (orb) => `${orb.id}:${width.step}`,
    create: () => drawOrb(frame.size, width.width),
    place: (sprite, orb) => placeOrb(sprite, orb, feel),
  });
  syncBursts(view, frame.collectibles.bursts, {
    orbSize: frame.size,
    crateSize: frame.crateSize,
    refillSize: frame.diveRefill.size,
    outline: width,
    feel,
  });
}
