import { Container, Graphics } from "pixi.js";
import { GAME_PALETTE, weaponLook } from "@/shared/config/gamePalette";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import type { WeaponItemId } from "@/shared/types/weaponItems.types";
import { inkColor } from "@/shared/utils/debugInk";
import { outlineWidth } from "@/shared/utils/outlineWidth";
import { weaponTubeParts } from "@/shared/utils/weaponTube";
import {
  blobPose,
  createBlobAnim,
  createContactHold,
  stepContactHold,
  type ContactHold,
  createFeetMotion,
  stepFeetMotion,
  type FeetMotion,
  type FeetTunables,
  createHelmetWobble,
  createGroundTilt,
  groundTiltLean,
  stepGroundTilt,
  type GroundTilt,
  type GroundTiltTunables,
  kickHelmetForHit,
  kickHelmetForSquash,
  noteBlobEvents,
  stepHelmetWobble,
  type BlobAnim,
  type BlobPose,
  type BlobPoseOverlay,
  type HelmetTunables,
  type HelmetWobble,
  type SquashTunables,
  barrelPopScale,
  type BarrelPopTunables,
} from "@/features/blob-look/services/blobPose";
import {
  blobMetrics,
  FOOT_CENTRE_UNITS,
  drawBodyFill,
  drawBodyFlash,
  drawBodyGloss,
  drawBodyInk,
  drawEye,
  drawFootFill,
  drawFootInk,
  drawHelmetDetails,
  drawHelmetFill,
  drawHelmetInk,
  drawMouthLight,
  drawTubeFill,
  drawTubeInk,
  helmetCentreY,
  type BlobMetrics,
} from "@/features/blob-look/services/blobShapes";
import {
  crouchEyeY,
  crouchGloss,
  crouchOutline,
  eyesUnderHelmet,
  noteCrouch,
  warmCrouchFit,
  type CrouchSink,
  type CrouchTunables,
} from "@/features/blob-look/services/crouchPose";
import { weaponAim, type PlayerState } from "@/features/player/api/playerApi";

/**
 * Player render layer in line style E (DESIGN_LANGUAGE § 2–6, mockup variant E): one blob per
 * player id — soft egg body with a radial gradient and white gloss, feet tucked under in the body
 * shade, gradient helmet with the slot's emblem (● ▲ ■ ✚), eyes toward the aim, the held weapon's
 * tube silhouette with its accent muzzle light (DESIGN_LANGUAGE § 9) — and one ink line around the
 * whole silhouette. Shapes come from `blobShapes.ts`.
 *
 * Each blob is two trees with identical transforms: `ink` (every part stroked in ink at twice the
 * outline width) under `fill` (the coloured parts, no stroke), so only the outer half of the ink
 * shows. No filters. Shapes are drawn once; per frame only transforms change (squash, foot motion,
 * roll spin, dive overlays, aim), and the ink redraws only when the zoom-clamped outline width
 * changes step. The spawn blink fades the fill tree; the outline stays.
 *
 * Contact shadows live in `shadows`, which the match renderer places on the shadow layer (§ 5 step 4).
 *
 * Game feel (§ 6): a hit flashes a white egg over the body fill (the ink stays, so the silhouette
 * never changes), and the helmet with its emblem rides a damped spring (`HelmetWobble`) kicked by
 * landings, jumps, wall-jumps, roll bounces and hits. The feet step, swing, tilt and splay, and
 * turn as one pair to the slope or wall under the blob (`blobPose.ts`).
 */
export interface PlayersView {
  container: Container;
  /** Contact shadows; placed by the match renderer under pickups (DESIGN_LANGUAGE § 5 step 4). */
  shadows: Container;
  sprites: Map<string, BlobSprite>;
}

/** One part of the blob in both trees; every transform is applied to both. */
interface PartPair {
  ink: Container;
  fill: Container;
}

interface BlobSprite {
  root: Container;
  /** Dashed spawn-protection ring (DESIGN_LANGUAGE § 6), hidden unless protected. */
  ring: Graphics;
  /** The fill tree (blinks while protected). */
  fills: Container;
  /** Feet-point origin: scaling squashes onto the ground. */
  body: PartPair;
  feet: [PartPair, PartPair];
  tube: PartPair;
  /**
   * Helmet parts on one spring: ink (with the barrel's ink), dome fill (under the eyes), the
   * barrel (over the eyes), gloss + emblem (over everything).
   */
  helmet: Container[];
  /** The barrel's shot pop: readiness last frame, and when the last shot was seen. */
  pop: { lastReady: number; startMs: number };
  /** White body over the body fill; alpha = hit flash. */
  flash: Graphics;
  /** Body fill and gloss: the crouch reshapes the body and slides the gloss (crouchPose.ts). */
  bodyFill: Graphics;
  gloss: Graphics;
  slot: number;
  /** The crouch pose the body is drawn in (`crouchShapeKey`), or null for the plain egg. */
  shapeKey: string | null;
  inks: { body: Graphics; helmet: Graphics; feet: [Graphics, Graphics]; tube: Graphics };
  /** Barrel fill and its mouth light, redrawn when the weapon or outline step changes. */
  tubeFill: Graphics;
  muzzle: Graphics;
  /** `itemId:step` the tube was drawn at (null before the first armed frame). */
  tubeKey: string | null;
  eyes: [Container, Container];
  pupils: [Graphics, Graphics];
  shadow: Graphics;
  anim: BlobAnim;
  wobble: HelmetWobble;
  feetMotion: FeetMotion;
  groundTilt: GroundTilt;
  /** Steadied ground / wall contact the feet, the lean and the shadow read. */
  contactHold: ContactHold;
  metrics: BlobMetrics;
  /** Outline step and width the ink was drawn at (null before the first draw). */
  inkStep: number | null;
  inkWidth: number;
}

/** A held weapon as the blob shows it (weapon-visuals D1, D3). */
export interface BlobWeapon {
  itemId: WeaponItemId;
  /** 0 just after a shot … 1 ready to fire; drives the muzzle light. */
  ready: number;
}

export interface SyncPlayersOptions {
  /** Animation clock, ms. Defaults to `performance.now()`. */
  nowMs?: number;
  squash?: SquashTunables;
  /** Players under spawn protection: they blink and wear the dashed ring (GDD § 6). */
  protectedIds?: ReadonlySet<string>;
  /** Ability poses by player id (e.g. the dive's headfirst turn), laid over the movement pose. */
  overlays?: ReadonlyMap<string, BlobPoseOverlay>;
  /** Held weapons by player id: they wear that weapon's tube with its ready light. */
  weapons?: ReadonlyMap<string, BlobWeapon>;
  /** Camera zoom (screen px per world unit) for the outline width clamp. Defaults to 1. */
  zoom?: number;
  /** Hit feedback by player id: flash alpha this frame, and a new `startMs` kicks the helmet. */
  hits?: ReadonlyMap<string, BlobHitFeel>;
  /** Helmet spring settings. Defaults to the shared tunables. */
  helmet?: HelmetTunables;
  /** Foot motion settings. Defaults to the shared tunables. */
  feet?: FeetTunables;
  /** Lean on sloped ground. Defaults to the shared tunables. */
  groundTilt?: GroundTiltTunables;
  /** Crouch pose settings. Defaults to the shared tunables. */
  crouch?: CrouchTunables;
  /** The barrel's shot pop. Defaults to the shared tunables. */
  barrelPop?: BarrelPopTunables;
}

/** What the renderer needs of a hit (the effects feature's `PlayerHitFeel` fits). */
export interface BlobHitFeel {
  startMs: number;
  dirX: number;
  hard: boolean;
  flash: number;
}

export const createPlayersView = (): PlayersView => ({
  container: new Container({ label: "players" }),
  shadows: new Container({ label: "player-shadows" }),
  sprites: new Map(),
});

const pair = (): PartPair => ({ ink: new Container(), fill: new Container() });

const eachSide = (p: PartPair, apply: (c: Container) => void): void => {
  apply(p.ink);
  apply(p.fill);
};

/** Dashed ink ring of radius 1.5 R around the torso (12 dashes). */
function drawProtectionRing(m: BlobMetrics): Graphics {
  const ring = new Graphics();
  const radius = 1.5 * m.r;
  const dashes = 12;
  for (let i = 0; i < dashes; i += 1) {
    const start = (i / dashes) * Math.PI * 2;
    ring.moveTo(Math.cos(start) * radius, Math.sin(start) * radius);
    ring.arc(0, 0, radius, start, start + (Math.PI / dashes) * 1.1);
  }
  ring.stroke({ width: 3.5 * m.u, color: GAME_PALETTE.ink, cap: "round" });
  ring.position.set(0, -m.bodyLift);
  ring.visible = false;
  return ring;
}

/** Blink the fill between full and 45 % alpha at 8 Hz while protected (DESIGN_LANGUAGE § 6). */
const BLINK = { hz: 8, lowAlpha: 0.45 };

function applyProtection(sprite: BlobSprite, isProtected: boolean, nowMs: number): void {
  sprite.ring.visible = isProtected;
  const low = Math.floor((nowMs / 1000) * BLINK.hz * 2) % 2 === 1;
  sprite.fills.alpha = isProtected && low ? BLINK.lowAlpha : 1;
}

/**
 * The helmet's four layers, each a container that the spring moves together. The weapon barrel
 * is part of the helmet (weapon-visuals-embellish D1, D2): its ink joins the helmet's ink and its
 * fill has a layer of its own, which the torso ranks over the eyes (D4).
 */
function buildHelmet(
  slot: number,
  m: BlobMetrics,
  parts: { ink: Graphics; tube: PartPair }
): Container[] {
  const layers = [new Container(), new Container(), new Container(), new Container()];
  layers[0]!.addChild(parts.tube.ink, parts.ink);
  layers[1]!.addChild(drawHelmetFill(m));
  layers[2]!.addChild(parts.tube.fill);
  layers[3]!.addChild(...drawHelmetDetails(slot, m));
  // Rock around the middle of the rim.
  for (const layer of layers) layer.pivot.set(0, m.helmet.rim);
  return layers;
}

/**
 * Torso (body centre origin) in both trees: body, flash, helmet dome, gloss, eyes, the weapon
 * barrel, and the helmet's gloss + emblem on top.
 */
function buildEyes(u: number) {
  const left = drawEye(u);
  const right = drawEye(u);
  const eyes: [Container, Container] = [new Container(), new Container()];
  eyes[0].addChild(left.white, left.pupil);
  eyes[1].addChild(right.white, right.pupil);
  return { eyes, pupils: [left.pupil, right.pupil] as [Graphics, Graphics] };
}

/** Empty tube graphics; their shape and muzzle light are drawn per held weapon (`syncTube`). */
function buildTube(sprite: Pick<BlobSprite, "tube" | "inks">) {
  const tubeFill = new Graphics();
  const muzzle = new Graphics();
  sprite.tube.ink.addChild(sprite.inks.tube);
  sprite.tube.fill.addChild(tubeFill, muzzle);
  return { tubeFill, muzzle };
}

/** Draw rank in the torso fill: eyes over the helmet dome (4), or under it while crouching. */
const EYES_OVER_HELMET = 6;
const EYES_UNDER_HELMET = 3;
/** The barrel covers the eyes where they overlap (weapon-visuals-embellish D4). */
const BARREL_OVER_EYES = 7;

/**
 * Adds children with a fixed draw rank (zIndex). The crouch re-ranks the eyes under the helmet
 * dome (`placeEyes`), so the order is kept by rank, not by insertion.
 */
function addRanked(parent: Container, children: readonly [Container, number][]): void {
  parent.sortableChildren = true;
  for (const [child, rank] of children) {
    child.zIndex = rank;
    parent.addChild(child);
  }
}

function buildTorso(
  sprite: Pick<BlobSprite, "body" | "tube" | "inks">,
  slot: number,
  m: BlobMetrics
) {
  const torso = pair();
  eachSide(torso, (c) => c.position.set(0, -m.bodyLift));
  const { tubeFill, muzzle } = buildTube(sprite);
  const helmet = buildHelmet(slot, m, { ink: sprite.inks.helmet, tube: sprite.tube });
  const [helmetInk, helmetDome, helmetBarrel, helmetDetails] = helmet as [
    Container,
    Container,
    Container,
    Container,
  ];
  torso.ink.addChild(sprite.inks.body, helmetInk);
  const { eyes, pupils } = buildEyes(m.u);
  const flash = drawBodyFlash(new Graphics(), m);
  flash.visible = false;
  const bodyFill = drawBodyFill(new Graphics(), m, { slot });
  const gloss = drawBodyGloss(m);
  addRanked(torso.fill, [
    [bodyFill, 1],
    [flash, 2],
    [helmetDome, 4],
    [gloss, 5],
    ...eyes.map((eye): [Container, number] => [eye, EYES_OVER_HELMET]),
    [helmetBarrel, BARREL_OVER_EYES],
    [helmetDetails, 8],
  ]);
  sprite.body.ink.addChild(torso.ink);
  sprite.body.fill.addChild(torso.fill);
  return { eyes, pupils, helmet, flash, bodyFill, gloss, tubeFill, muzzle };
}

function createBlobSprite(player: PlayerState): BlobSprite {
  const m = blobMetrics(player.height);
  const inks = {
    body: new Graphics(),
    helmet: new Graphics(),
    feet: [new Graphics(), new Graphics()] as [Graphics, Graphics],
    tube: new Graphics(),
  };
  const feet: [PartPair, PartPair] = [pair(), pair()];
  const body = pair();
  const tube = pair();
  const { eyes, pupils, helmet, flash, bodyFill, gloss, tubeFill, muzzle } = buildTorso(
    { body, tube, inks },
    player.slot,
    m
  );
  const inkTree = new Container({ label: "ink" });
  const fills = new Container({ label: "fill" });
  feet.forEach((foot, i) => {
    foot.ink.addChild(inks.feet[i]!);
    foot.fill.addChild(drawFootFill(player.slot, m));
    inkTree.addChild(foot.ink);
    fills.addChild(foot.fill);
  });
  inkTree.addChild(body.ink);
  fills.addChild(body.fill);
  const root = new Container({ label: player.id });
  const ring = drawProtectionRing(m);
  root.addChild(ring, inkTree, fills);
  return {
    root,
    ring,
    fills,
    body,
    feet,
    tube,
    helmet,
    flash,
    bodyFill,
    gloss,
    slot: player.slot,
    shapeKey: null,
    inks,
    tubeFill,
    muzzle,
    tubeKey: null,
    pop: { lastReady: 1, startMs: Number.NEGATIVE_INFINITY },
    eyes,
    pupils,
    shadow: new Graphics().ellipse(0, 0, 1, 1).fill(inkColor("other")),
    anim: createBlobAnim(player),
    wobble: createHelmetWobble(),
    feetMotion: createFeetMotion(player),
    groundTilt: createGroundTilt(),
    contactHold: createContactHold(player),
    metrics: m,
    inkStep: null,
    inkWidth: 0,
  };
}

/** Redraws the ink pass when the zoom-clamped outline width changed step. */
function syncInk(sprite: BlobSprite, zoom: number): void {
  const outline = outlineWidth("character", zoom);
  if (outline.step === sprite.inkStep) return;
  const { metrics: m, inks } = sprite;
  drawBodyInk(inks.body, m, { width: outline.width });
  drawHelmetInk(inks.helmet, m, outline.width);
  inks.feet.forEach((foot) => drawFootInk(foot, m, outline.width));
  sprite.inkStep = outline.step;
  sprite.inkWidth = outline.width;
  // The ink was just drawn as the egg: a crouched body redraws its outline this frame.
  if (sprite.shapeKey !== null) sprite.shapeKey = "";
}

/**
 * The body in its crouch outline (fill, hit flash and ink) while crouched, and back to the plain
 * egg once on the frame the crouch ends; standing blobs never redraw (crouch-sink D1).
 */
function syncBodyShape(sprite: BlobSprite, frame: { sink: CrouchSink; crouch: CrouchTunables }) {
  const { metrics: m } = sprite;
  const outline = crouchOutline(m, frame);
  const key = outline ? crouchShapeKey(frame.sink) : null;
  if (key === sprite.shapeKey) return outline;
  const shape = outline ?? undefined;
  drawBodyFill(sprite.bodyFill, m, { slot: sprite.slot, outline: shape });
  drawBodyFlash(sprite.flash, m, shape);
  drawBodyInk(sprite.inks.body, m, { width: sprite.inkWidth, outline: shape });
  sprite.shapeKey = key;
  return outline;
}

/** The crouch pose rounded to what shows (a twentieth of a mockup unit), so a still hold skips redraws. */
const crouchShapeKey = ({ helmetSink, drop, bulge }: CrouchSink): string =>
  `${Math.round(helmetSink * 20)}:${Math.round(drop * 20)}:${Math.round(bulge * 100)}`;

/** Mouth light alpha while a shot recharges (faded, never fully gone) … ready (full). */
const MUZZLE_MIN_ALPHA = 0.15;
/** Readiness falling this much in one frame is a shot (a recharge only ever rises). */
const SHOT_READY_DROP = 0.5;

/** Draws the barrel of `itemId` in both passes when the weapon or the outline step changed. */
function redrawTube(sprite: BlobSprite, itemId: WeaponItemId, zoom: number): void {
  const outline = outlineWidth("character", zoom);
  const key = `${itemId}:${outline.step}`;
  if (sprite.tubeKey === key) return;
  const look = weaponLook(itemId);
  const tube = weaponTubeParts(look.tube, sprite.metrics.u);
  drawTubeInk(sprite.inks.tube, tube, outline.width);
  drawTubeFill(sprite.tubeFill, tube);
  drawMouthLight(sprite.muzzle, tube, look.accent);
  sprite.tubeKey = key;
}

interface TubeFrame {
  weapon: BlobWeapon | undefined;
  zoom: number;
  nowMs: number;
  pop: BarrelPopTunables;
}

/**
 * The held weapon's barrel (DESIGN_LANGUAGE § 9): its silhouette in both passes, redrawn only when
 * the weapon or the outline step changes. Each frame the mouth light's alpha follows readiness,
 * and a shot (readiness dropping) pops the barrel short and fat for a moment.
 */
function syncTube(sprite: BlobSprite, frame: TubeFrame): void {
  const { weapon, zoom, nowMs } = frame;
  if (!weapon) {
    sprite.pop.lastReady = 1;
    return;
  }
  redrawTube(sprite, weapon.itemId, zoom);
  const ready = Math.max(0, Math.min(1, weapon.ready));
  sprite.muzzle.alpha = MUZZLE_MIN_ALPHA + (1 - MUZZLE_MIN_ALPHA) * ready;
  if (ready < sprite.pop.lastReady - SHOT_READY_DROP) sprite.pop.startMs = nowMs;
  sprite.pop.lastReady = ready;
  const { sx, sy } = barrelPopScale(nowMs - sprite.pop.startMs, frame.pop);
  eachSide(sprite.tube, (c) => c.scale.set(sx, sy));
}

/** World units a drawn hop raises the blob (render only; 0 without one). */
const overlayLift = (overlay: BlobPoseOverlay | undefined): number => overlay?.lift ?? 0;

interface PoseFrame {
  pose: BlobPose;
  overlay: BlobPoseOverlay | undefined;
  armed: boolean;
  feet: FeetTunables | undefined;
  groundTilt: GroundTiltTunables | undefined;
  crouch: CrouchTunables;
  nowMs: number;
}

/** The body's scale: the movement pose's squash times the overlay's. */
const bodyScale = ({ pose, overlay }: Pick<PoseFrame, "pose" | "overlay">) => ({
  sx: pose.bodySx * (overlay?.sx ?? 1),
  sy: pose.bodySy * (overlay?.sy ?? 1),
});

/**
 * Places and scales the blob. The root turns around the body centre (overlay rotation, roll, and
 * the lean on sloped ground).
 */
function placeBlob(sprite: BlobSprite, player: PlayerState, frame: PoseFrame): void {
  const { overlay } = frame;
  // With no overlay, roll or slope this is the plain feet-point placement.
  const centerY = player.height / 2 + overlayLift(overlay);
  sprite.root.pivot.set(0, -player.height / 2);
  sprite.root.position.set(player.x, player.y - centerY);
  const { contact } = sprite.contactHold;
  const slopeLean = stepGroundTilt(sprite.groundTilt, {
    groundAngle: contact.groundAngle,
    grounded: contact.grounded,
    nowMs: frame.nowMs,
    tunables: frame.groundTilt ?? DEFAULT_GAME_TUNABLES.feel.groundTilt,
  });
  // The roll's spin is sim state (`roll.ts`): it follows the ball physics and eases upright.
  sprite.root.rotation = (overlay?.rotation ?? 0) + player.rollAngle + slopeLean;
  const { sx, sy } = bodyScale(frame);
  const lean = overlay ? 0 : Math.max(-0.15, Math.min(0.15, player.vx / 2400));
  eachSide(sprite.body, (c) => {
    c.scale.set(sx, sy);
    c.rotation = lean;
  });
}

/** Feet scaled below this by the crouch are not drawn. */
const FEET_HIDDEN_BELOW = 0.02;

/**
 * Feet lag the body's squash a little and move per `stepFeetMotion`, which turns them around the
 * body circle to the surface under the blob (the root already carries the slope lean, the feet
 * turn the rest). Each foot turns around its own centre; the centre drops with the squash so the
 * sole stays on the ground.
 */
function placeFeet(sprite: BlobSprite, player: PlayerState, frame: PoseFrame): void {
  const { r, u } = sprite.metrics;
  const { pose } = frame;
  const centre = FOOT_CENTRE_UNITS * u;
  const poses = stepFeetMotion(sprite.feetMotion, {
    player,
    feet: frame.feet ?? DEFAULT_GAME_TUNABLES.feel.feet,
    r,
    bodySx: pose.bodySx,
    footCentre: centre,
    rootLean: groundTiltLean(sprite.groundTilt),
    contact: sprite.contactHold.contact,
    nowMs: frame.nowMs,
  });
  // The crouch makes the feet vanish (owner, crouch-sink D2).
  const shown = pose.crouch.feetScale;
  sprite.feet.forEach((foot, i) => {
    const p = poses[i]!;
    eachSide(foot, (c) => {
      c.visible = shown > FEET_HIDDEN_BELOW;
      c.pivot.set(0, -centre);
      c.position.set(p.x, p.y - centre * pose.feetSy);
      c.rotation = p.rotation;
      c.scale.set(pose.feetSx * shown, pose.feetSy * shown);
    });
  });
}

interface EyeLook {
  sink: CrouchSink;
  pupilScale: number;
  /** The body's scale this frame; the eyes undo it (owner, squish-eyes). */
  bodyScale: { sx: number; sy: number };
}

/**
 * Eyes sit under the helmet rim and look toward the aim. While crouching they ride down with the
 * face and slip under the dome, so the sunk rim covers the top half of each eye. Every squash
 * squishes the body but never the eyes: they ride their spot on the squashed face and undo the
 * body's scale, so they keep their size and shape (owner, squish-eyes).
 */
function placeEyes(sprite: BlobSprite, player: PlayerState, look: EyeLook): void {
  const { sink, pupilScale, bodyScale } = look;
  const { r, u } = sprite.metrics;
  const y = crouchEyeY(sprite.metrics, sink) + player.aimY * 2 * u;
  sprite.eyes.forEach((eye, i) => {
    const side = i === 0 ? -1 : 1;
    eye.position.set(side * 0.27 * r + player.aimX * 5 * u, y);
    eye.scale.set(1 / bodyScale.sx, 1 / bodyScale.sy);
    eye.zIndex = eyesUnderHelmet(sink) ? EYES_UNDER_HELMET : EYES_OVER_HELMET;
    sprite.pupils[i]!.position.set(player.aimX * 1.6 * u, 1.5 * u + player.aimY * 1.2 * u);
    sprite.pupils[i]!.scale.set(pupilScale);
  });
}

/**
 * The barrel pivots on the helmet centre toward the weapon aim (weapon-visuals-embellish D1). The
 * helmet turns with the root (roll, slope lean, overlays), so the root's turn is taken back out:
 * the barrel points where the weapon fires, swept by a roll (spin-fire D1).
 */
function placeFace(sprite: BlobSprite, player: PlayerState, armed: boolean): void {
  const pivotY = helmetCentreY(sprite.metrics);
  const aim = weaponAim(player);
  const angle = Math.atan2(aim.y, aim.x) - sprite.root.rotation;
  eachSide(sprite.tube, (c) => {
    c.visible = armed;
    c.position.set(0, pivotY);
    c.rotation = angle;
  });
}

function applyPose(sprite: BlobSprite, player: PlayerState, frame: PoseFrame): void {
  const { pose } = frame;
  placeBlob(sprite, player, frame);
  placeFeet(sprite, player, frame);
  const outline = syncBodyShape(sprite, { sink: pose.crouch, crouch: frame.crouch });
  const gloss = crouchGloss(sprite.metrics, { sink: pose.crouch, outline });
  sprite.gloss.position.set(gloss.x, gloss.y);
  sprite.gloss.rotation = gloss.rotation;
  placeEyes(sprite, player, {
    sink: pose.crouch,
    pupilScale: frame.overlay?.pupilScale ?? 1,
    bodyScale: bodyScale(frame),
  });
  placeFace(sprite, player, frame.armed);
  const { shadow } = pose;
  sprite.shadow.visible = shadow !== null;
  if (!shadow) return;
  sprite.shadow.position.set(player.x, shadow.y);
  sprite.shadow.scale.set(shadow.width / 2, shadow.height / 2);
  sprite.shadow.alpha = shadow.alpha;
}

interface FeelFrame {
  moment: BlobAnim["active"];
  hit: BlobHitFeel | undefined;
  helmet: HelmetTunables | undefined;
  nowMs: number;
  /** Extra helmet sink of the crouch, mockup units. */
  crouchDrop: number;
}

/** Kicks the helmet spring for this frame's squash moment and for a new hit. */
function kickHelmet(wobble: HelmetWobble, player: PlayerState, frame: FeelFrame): void {
  const { moment, hit } = frame;
  const helmet = frame.helmet ?? DEFAULT_GAME_TUNABLES.feel.helmet;
  if (moment) {
    const rolling = player.rollSource !== null;
    kickHelmetForSquash(wobble, { ...moment, vx: player.vx, rolling }, helmet);
  }
  if (hit && hit.startMs !== wobble.seenHitMs) {
    wobble.seenHitMs = hit.startMs;
    kickHelmetForHit(wobble, hit, helmet);
  }
}

/** Hit flash on the fill, and the helmet spring: kicked by this frame's moments, then stepped. */
function applyFeel(sprite: BlobSprite, player: PlayerState, frame: FeelFrame): void {
  const { wobble } = sprite;
  kickHelmet(wobble, player, frame);
  const helmet = frame.helmet ?? DEFAULT_GAME_TUNABLES.feel.helmet;
  stepHelmetWobble(wobble, { nowMs: frame.nowMs, helmet });
  const { rim } = sprite.metrics.helmet;
  const drop = (wobble.pose.drop + frame.crouchDrop) * sprite.metrics.u;
  for (const layer of sprite.helmet) {
    layer.position.set(0, rim + drop);
    layer.rotation = wobble.pose.tilt;
  }
  const flash = frame.hit?.flash ?? 0;
  sprite.flash.visible = flash > 0;
  sprite.flash.alpha = flash;
}

/** The sprite for this player, created and added to the layer on first sight. */
function spriteFor(view: PlayersView, player: PlayerState, crouch: CrouchTunables): BlobSprite {
  const existing = view.sprites.get(player.id);
  if (existing) return existing;
  const sprite = createBlobSprite(player);
  warmCrouchFit(sprite.metrics, crouch);
  view.sprites.set(player.id, sprite);
  view.container.addChild(sprite.root);
  view.shadows.addChild(sprite.shadow);
  return sprite;
}

/** Removes sprites of players that left the state. */
function pruneSprites(view: PlayersView, seen: ReadonlySet<string>): void {
  for (const [id, sprite] of view.sprites) {
    if (seen.has(id)) continue;
    sprite.root.destroy({ children: true });
    sprite.shadow.destroy();
    view.sprites.delete(id);
  }
}

/** Squash, crouch and contact-hold settings, defaulting to the shared tunables. */
const bodyTunables = (options: SyncPlayersOptions) => ({
  squash: options.squash ?? DEFAULT_GAME_TUNABLES.player.squash,
  crouch: options.crouch ?? DEFAULT_GAME_TUNABLES.player.crouch,
  holdSeconds: (options.feet ?? DEFAULT_GAME_TUNABLES.feel.feet).contactHoldSeconds,
});

/** Matches the layer to the current players and poses them. Call once per rendered frame. */
export function syncPlayersView(
  view: PlayersView,
  players: readonly PlayerState[],
  options: SyncPlayersOptions = {}
): void {
  const nowMs = options.nowMs ?? performance.now();
  const { squash, crouch, holdSeconds } = bodyTunables(options);
  const { helmet } = options;
  const zoom = options.zoom ?? 1;
  for (const player of players) {
    const sprite = spriteFor(view, player, crouch);
    const moment = noteBlobEvents(sprite.anim, { player, squash, nowMs });
    noteCrouch(sprite.anim.crouch, { player, crouch, nowMs });
    // Steadied first: the shadow, the lean and the feet all read it this frame.
    const pose = blobPose(sprite.anim, {
      player,
      squash,
      nowMs,
      crouch,
      contact: stepContactHold(sprite.contactHold, { player, nowMs, seconds: holdSeconds }),
    });
    syncInk(sprite, zoom);
    syncTube(sprite, {
      weapon: options.weapons?.get(player.id),
      zoom,
      nowMs,
      pop: options.barrelPop ?? DEFAULT_GAME_TUNABLES.feel.barrelPop,
    });
    applyPose(sprite, player, {
      pose,
      overlay: options.overlays?.get(player.id),
      armed: options.weapons?.has(player.id) === true,
      feet: options.feet,
      groundTilt: options.groundTilt,
      crouch,
      nowMs,
    });
    applyFeel(sprite, player, {
      moment,
      hit: options.hits?.get(player.id),
      helmet,
      nowMs,
      crouchDrop: pose.crouch.helmetSink + pose.crouch.drop,
    });
    applyProtection(sprite, options.protectedIds?.has(player.id) === true, nowMs);
  }
  pruneSprites(view, new Set(players.map((player) => player.id)));
}
