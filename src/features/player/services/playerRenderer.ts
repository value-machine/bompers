import { Container, Graphics } from "pixi.js";
import { GAME_PALETTE, weaponLook } from "@/shared/config/gamePalette";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import type { WeaponItemId } from "@/shared/types/weaponItems.types";
import { outlineWidth } from "@/shared/utils/outlineWidth";
import { weaponTubeParts } from "@/shared/utils/weaponTube";
import {
  blobPose,
  createBlobAnim,
  createFeetMotion,
  stepFeetMotion,
  type FeetMotion,
  type FeetTunables,
  createHelmetWobble,
  createGroundTilt,
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
  type CrouchFace,
  type CrouchTunables,
  stepCrouchBlend,
  type HelmetTunables,
  type HelmetWobble,
  type SquashTunables,
} from "@/features/player/services/blobPose";
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
  drawMuzzleLight,
  drawTubeFill,
  drawTubeInk,
  type BlobMetrics,
} from "@/features/player/services/blobShapes";
import type { PlayerState } from "@/features/player/types/player.types";

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
 * tumble roll, dive overlays, aim), and the ink redraws only when the zoom-clamped outline width
 * changes step. The spawn blink fades the fill tree; the outline stays.
 *
 * Contact shadows live in `shadows`, which the match renderer places on the shadow layer (§ 5 step 4).
 *
 * Game feel (§ 6): a hit flashes a white egg over the body fill (the ink stays, so the silhouette
 * never changes), and the helmet with its emblem rides a damped spring (`HelmetWobble`) kicked by
 * landings, jumps, wall-jumps, tumble bounces and hits. The feet step, swing, tilt and splay, and
 * turn their soles to the wall while wall-sliding (`blobPose.ts`).
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
  /** Helmet parts on one spring: ink, dome fill (under the eyes), gloss + emblem (over them). */
  helmet: Container[];
  /** White egg over the body fill; alpha = hit flash. */
  flash: Graphics;
  inks: { body: Graphics; helmet: Graphics; feet: [Graphics, Graphics]; tube: Graphics };
  /** Tube fill and its muzzle light, redrawn when the weapon or outline step changes. */
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
  metrics: BlobMetrics;
  /** Outline step the ink was drawn at (null before the first draw). */
  inkStep: number | null;
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

/** The helmet's three layers, each a container that the spring moves together. */
function buildHelmet(slot: number, m: BlobMetrics, ink: Graphics): Container[] {
  const layers = [new Container(), new Container(), new Container()];
  layers[0]!.addChild(ink);
  layers[1]!.addChild(drawHelmetFill(m));
  layers[2]!.addChild(...drawHelmetDetails(slot, m));
  // Rock around the middle of the rim.
  for (const layer of layers) layer.pivot.set(0, m.helmet.rim);
  return layers;
}

/**
 * Torso (body centre origin) in both trees: tube under the body; then body, flash, helmet dome,
 * gloss, eyes, and the helmet's gloss + emblem on top.
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
  const helmet = buildHelmet(slot, m, sprite.inks.helmet);
  const [helmetInk, helmetDome, helmetDetails] = helmet as [Container, Container, Container];
  torso.ink.addChild(sprite.tube.ink, sprite.inks.body, helmetInk);
  const { eyes, pupils } = buildEyes(m.u);
  const flash = drawBodyFlash(m);
  flash.visible = false;
  addRanked(torso.fill, [
    [sprite.tube.fill, 0],
    [drawBodyFill(slot, m), 1],
    [flash, 2],
    [helmetDome, 4],
    [drawBodyGloss(m), 5],
    ...eyes.map((eye): [Container, number] => [eye, EYES_OVER_HELMET]),
    [helmetDetails, 7],
  ]);
  sprite.body.ink.addChild(torso.ink);
  sprite.body.fill.addChild(torso.fill);
  return { eyes, pupils, helmet, flash, tubeFill, muzzle };
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
  const { eyes, pupils, helmet, flash, tubeFill, muzzle } = buildTorso(
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
    inks,
    tubeFill,
    muzzle,
    tubeKey: null,
    eyes,
    pupils,
    shadow: new Graphics().ellipse(0, 0, 1, 1).fill(GAME_PALETTE.ink),
    anim: createBlobAnim(player),
    wobble: createHelmetWobble(),
    feetMotion: createFeetMotion(player),
    groundTilt: createGroundTilt(),
    metrics: m,
    inkStep: null,
  };
}

/** Redraws the ink pass when the zoom-clamped outline width changed step. */
function syncInk(sprite: BlobSprite, zoom: number): void {
  const outline = outlineWidth("character", zoom);
  if (outline.step === sprite.inkStep) return;
  const { metrics: m, inks } = sprite;
  drawBodyInk(inks.body, m, outline.width);
  drawHelmetInk(inks.helmet, m, outline.width);
  inks.feet.forEach((foot) => drawFootInk(foot, m, outline.width));
  sprite.inkStep = outline.step;
}

/** Muzzle light alpha while a shot recharges (faded, never fully gone) … ready (full). */
const MUZZLE_MIN_ALPHA = 0.15;

/**
 * The held weapon's tube (DESIGN_LANGUAGE § 9): its silhouette in both passes, redrawn only when
 * the weapon or the outline step changes; the muzzle light's alpha follows readiness each frame.
 */
function syncTube(sprite: BlobSprite, weapon: BlobWeapon | undefined, zoom: number): void {
  if (!weapon) return;
  const outline = outlineWidth("character", zoom);
  const key = `${weapon.itemId}:${outline.step}`;
  if (sprite.tubeKey !== key) {
    const { u } = sprite.metrics;
    const look = weaponLook(weapon.itemId);
    const tube = weaponTubeParts(look.tube, u);
    drawTubeInk(sprite.inks.tube, tube, outline.width);
    drawTubeFill(sprite.tubeFill, tube);
    drawMuzzleLight(sprite.muzzle, tube, { accent: look.accent, u });
    sprite.tubeKey = key;
  }
  const ready = Math.max(0, Math.min(1, weapon.ready));
  sprite.muzzle.alpha = MUZZLE_MIN_ALPHA + (1 - MUZZLE_MIN_ALPHA) * ready;
}

/** A tumbling blob rolls with the distance it travels, like a ball; 0 when not tumbling. */
const tumbleRoll = (player: PlayerState, r: number): number =>
  player.tumbleSeconds > 0 ? (player.x / (1.6 * r)) % (Math.PI * 2) : 0;

/** World units a drawn hop raises the blob (render only; 0 without one). */
const overlayLift = (overlay: BlobPoseOverlay | undefined): number => overlay?.lift ?? 0;

interface PoseFrame {
  pose: BlobPose;
  overlay: BlobPoseOverlay | undefined;
  armed: boolean;
  feet: FeetTunables | undefined;
  groundTilt: GroundTiltTunables | undefined;
  nowMs: number;
}

/**
 * Places and scales the blob. The root turns around the body centre (overlay rotation, roll, and
 * the lean on sloped ground).
 */
function placeBlob(sprite: BlobSprite, player: PlayerState, frame: PoseFrame): void {
  const { pose, overlay } = frame;
  // With no overlay, roll or slope this is the plain feet-point placement.
  const centerY = player.height / 2 + overlayLift(overlay);
  sprite.root.pivot.set(0, -player.height / 2);
  sprite.root.position.set(player.x, player.y - centerY);
  const slopeLean = stepGroundTilt(sprite.groundTilt, {
    groundAngle: player.groundAngle,
    grounded: player.grounded,
    nowMs: frame.nowMs,
    tunables: frame.groundTilt ?? DEFAULT_GAME_TUNABLES.feel.groundTilt,
  });
  const roll = tumbleRoll(player, sprite.metrics.r);
  sprite.root.rotation = (overlay?.rotation ?? 0) + roll + slopeLean;
  const sx = pose.bodySx * (overlay?.sx ?? 1);
  const sy = pose.bodySy * (overlay?.sy ?? 1);
  const lean = overlay ? 0 : Math.max(-0.15, Math.min(0.15, player.vx / 2400));
  eachSide(sprite.body, (c) => {
    c.scale.set(sx, sy);
    c.rotation = lean;
  });
}

/**
 * Feet lag the body's squash a little and move per `stepFeetMotion`. Each foot turns around its own
 * centre; the centre drops with the squash so the sole stays on the ground.
 */
function placeFeet(sprite: BlobSprite, player: PlayerState, frame: PoseFrame): void {
  const { r, u } = sprite.metrics;
  const { pose } = frame;
  const poses = stepFeetMotion(sprite.feetMotion, {
    player,
    feet: frame.feet ?? DEFAULT_GAME_TUNABLES.feel.feet,
    r,
    bodySx: pose.bodySx,
    nowMs: frame.nowMs,
  });
  const centre = FOOT_CENTRE_UNITS * u;
  sprite.feet.forEach((foot, i) => {
    const p = poses[i]!;
    eachSide(foot, (c) => {
      c.pivot.set(0, -centre);
      c.position.set(p.x, p.y - centre * pose.feetSy);
      c.rotation = p.rotation;
      c.scale.set(pose.feetSx, pose.feetSy);
    });
  });
}

/**
 * Eyes sit under the helmet rim and look toward the aim. While crouching they rise a little and
 * slip under the dome, so the lowered rim covers about half of each eye (crouch D7).
 */
function placeEyes(
  sprite: BlobSprite,
  player: PlayerState,
  look: { face: CrouchFace; pupilScale: number }
): void {
  const { face, pupilScale } = look;
  const { r, u } = sprite.metrics;
  const y = 0.12 * r + player.aimY * 2 * u - face.eyeLift * u;
  sprite.eyes.forEach((eye, i) => {
    const side = i === 0 ? -1 : 1;
    eye.position.set(side * 0.27 * r + player.aimX * 5 * u, y);
    eye.zIndex = face.eyesUnderHelmet ? EYES_UNDER_HELMET : EYES_OVER_HELMET;
    sprite.pupils[i]!.position.set(player.aimX * 1.6 * u, 1.5 * u + player.aimY * 1.2 * u);
    sprite.pupils[i]!.scale.set(pupilScale);
  });
}

/** The tube pivots toward the aim. */
function placeFace(sprite: BlobSprite, player: PlayerState, armed: boolean): void {
  const { r, u, helmet } = sprite.metrics;
  const angle = Math.atan2(player.aimY, player.aimX);
  eachSide(sprite.tube, (c) => {
    c.visible = armed;
    c.position.set(
      Math.cos(angle) * r * 0.5,
      (helmet.top + helmet.rim) / 2 - 2 * u + Math.sin(angle) * 4 * u
    );
    c.rotation = angle;
  });
}

function applyPose(sprite: BlobSprite, player: PlayerState, frame: PoseFrame): void {
  const { pose } = frame;
  placeBlob(sprite, player, frame);
  placeFeet(sprite, player, frame);
  placeEyes(sprite, player, { face: pose.face, pupilScale: frame.overlay?.pupilScale ?? 1 });
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
    const tumbling = player.tumbleSeconds > 0;
    kickHelmetForSquash(wobble, { ...moment, vx: player.vx, tumbling }, helmet);
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
function spriteFor(view: PlayersView, player: PlayerState): BlobSprite {
  const existing = view.sprites.get(player.id);
  if (existing) return existing;
  const sprite = createBlobSprite(player);
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

/** Squash and crouch settings, defaulting to the shared tunables. */
const bodyTunables = (options: SyncPlayersOptions) => ({
  squash: options.squash ?? DEFAULT_GAME_TUNABLES.player.squash,
  crouch: options.crouch ?? DEFAULT_GAME_TUNABLES.player.crouch,
});

/** Matches the layer to the current players and poses them. Call once per rendered frame. */
export function syncPlayersView(
  view: PlayersView,
  players: readonly PlayerState[],
  options: SyncPlayersOptions = {}
): void {
  const nowMs = options.nowMs ?? performance.now();
  const { squash, crouch } = bodyTunables(options);
  const { helmet } = options;
  const zoom = options.zoom ?? 1;
  for (const player of players) {
    const sprite = spriteFor(view, player);
    const moment = noteBlobEvents(sprite.anim, { player, squash, nowMs });
    stepCrouchBlend(sprite.anim, { player, crouch, nowMs });
    const pose = blobPose(sprite.anim, { player, squash, nowMs, crouch });
    syncInk(sprite, zoom);
    syncTube(sprite, options.weapons?.get(player.id), zoom);
    applyPose(sprite, player, {
      pose,
      overlay: options.overlays?.get(player.id),
      armed: options.weapons?.has(player.id) === true,
      feet: options.feet,
      groundTilt: options.groundTilt,
      nowMs,
    });
    applyFeel(sprite, player, {
      moment,
      hit: options.hits?.get(player.id),
      helmet,
      nowMs,
      crouchDrop: pose.face.helmetDrop,
    });
    applyProtection(sprite, options.protectedIds?.has(player.id) === true, nowMs);
  }
  pruneSprites(view, new Set(players.map((player) => player.id)));
}
