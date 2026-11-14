import { Container, Graphics } from "pixi.js";
import { GAME_PALETTE } from "@/shared/config/gamePalette";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import { outlineWidth } from "@/shared/utils/outlineWidth";
import {
  blobPose,
  createBlobAnim,
  noteBlobEvents,
  type BlobAnim,
  type BlobPose,
  type BlobPoseOverlay,
  type SquashTunables,
} from "@/features/player/services/blobPose";
import {
  blobMetrics,
  drawBodyGloss,
  drawEye,
  drawFootFill,
  drawFootInk,
  drawHelmetDetails,
  drawTorsoFill,
  drawTorsoInk,
  drawTubeFill,
  drawTubeInk,
  type BlobMetrics,
} from "@/features/player/services/blobShapes";
import type { PlayerState } from "@/features/player/types/player.types";

/**
 * Player render layer in line style E (DESIGN_LANGUAGE § 2–6, mockup variant E): one blob per
 * player id — soft egg body with a radial gradient and white gloss, feet tucked under in the body
 * shade, gradient helmet with the slot's emblem (● ▲ ■ ✚), eyes toward the aim, the rocket tube
 * while armed — and one ink line around the whole silhouette. Shapes come from `blobShapes.ts`.
 *
 * Each blob is two trees with identical transforms: `ink` (every part stroked in ink at twice the
 * outline width) under `fill` (the coloured parts, no stroke), so only the outer half of the ink
 * shows. No filters. Shapes are drawn once; per frame only transforms change (squash, foot lift,
 * tumble roll, dive overlays, aim), and the ink redraws only when the zoom-clamped outline width
 * changes step. The spawn blink fades the fill tree; the outline stays.
 *
 * Contact shadows live in `shadows`, which the match renderer places on the shadow layer (§ 5 step 4).
 * Not yet: helmet spring wobble, hit flash (motion polish).
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
  inks: { torso: Graphics; feet: [Graphics, Graphics]; tube: Graphics };
  eyes: [Container, Container];
  pupils: [Graphics, Graphics];
  shadow: Graphics;
  anim: BlobAnim;
  metrics: BlobMetrics;
  /** Outline step the ink was drawn at (null before the first draw). */
  inkStep: number | null;
}

export interface SyncPlayersOptions {
  /** Animation clock, ms. Defaults to `performance.now()`. */
  nowMs?: number;
  squash?: SquashTunables;
  /** Players under spawn protection: they blink and wear the dashed ring (GDD § 6). */
  protectedIds?: ReadonlySet<string>;
  /** Ability poses by player id (e.g. the dive's headfirst turn), laid over the movement pose. */
  overlays?: ReadonlyMap<string, BlobPoseOverlay>;
  /** Players holding a weapon: they wear the rocket tube on the helmet. */
  armedIds?: ReadonlySet<string>;
  /** Camera zoom (screen px per world unit) for the outline width clamp. Defaults to 1. */
  zoom?: number;
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

/** Torso (body centre origin) in both trees: tube under the body, then body + helmet, details. */
function buildTorso(
  sprite: Pick<BlobSprite, "body" | "tube" | "inks">,
  slot: number,
  m: BlobMetrics
) {
  const torso = pair();
  eachSide(torso, (c) => c.position.set(0, -m.bodyLift));
  sprite.tube.ink.addChild(sprite.inks.tube);
  sprite.tube.fill.addChild(drawTubeFill(m.u));
  torso.ink.addChild(sprite.tube.ink, sprite.inks.torso);
  const left = drawEye(m.u);
  const right = drawEye(m.u);
  const eyes: [Container, Container] = [new Container(), new Container()];
  eyes[0].addChild(left.white, left.pupil);
  eyes[1].addChild(right.white, right.pupil);
  torso.fill.addChild(
    sprite.tube.fill,
    drawTorsoFill(slot, m),
    drawBodyGloss(m),
    ...eyes,
    ...drawHelmetDetails(slot, m)
  );
  sprite.body.ink.addChild(torso.ink);
  sprite.body.fill.addChild(torso.fill);
  return { eyes, pupils: [left.pupil, right.pupil] as [Graphics, Graphics] };
}

function createBlobSprite(player: PlayerState): BlobSprite {
  const m = blobMetrics(player.height);
  const inks = {
    torso: new Graphics(),
    feet: [new Graphics(), new Graphics()] as [Graphics, Graphics],
    tube: new Graphics(),
  };
  const feet: [PartPair, PartPair] = [pair(), pair()];
  const body = pair();
  const tube = pair();
  const { eyes, pupils } = buildTorso({ body, tube, inks }, player.slot, m);
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
    inks,
    eyes,
    pupils,
    shadow: new Graphics().ellipse(0, 0, 1, 1).fill(GAME_PALETTE.ink),
    anim: createBlobAnim(player),
    metrics: m,
    inkStep: null,
  };
}

/** Redraws the ink pass when the zoom-clamped outline width changed step. */
function syncInk(sprite: BlobSprite, zoom: number): void {
  const outline = outlineWidth("character", zoom);
  if (outline.step === sprite.inkStep) return;
  const { metrics: m, inks } = sprite;
  drawTorsoInk(inks.torso, m, outline.width);
  inks.feet.forEach((foot) => drawFootInk(foot, m, outline.width));
  drawTubeInk(inks.tube, m.u, outline.width);
  sprite.inkStep = outline.step;
}

/** Alternating foot lift while running on the ground, from the distance travelled. */
function footLift(player: PlayerState, r: number): [number, number] {
  if (!player.grounded || Math.abs(player.vx) < 20) return [0, 0];
  const wave = Math.sin(player.x / (0.9 * r));
  return [Math.max(0, wave) * 0.22 * r, Math.max(0, -wave) * 0.22 * r];
}

/** A tumbling blob rolls with the distance it travels, like a ball; 0 when not tumbling. */
const tumbleRoll = (player: PlayerState, r: number): number =>
  player.tumbleSeconds > 0 ? (player.x / (1.6 * r)) % (Math.PI * 2) : 0;

interface PoseFrame {
  pose: BlobPose;
  overlay: BlobPoseOverlay | undefined;
  armed: boolean;
}

/** Places and scales the blob. The root turns around the body centre (overlay rotation, roll). */
function placeBlob(sprite: BlobSprite, player: PlayerState, frame: PoseFrame): void {
  const { pose, overlay } = frame;
  // With no overlay and no roll this is the plain feet-point placement.
  const centerY = player.height / 2;
  sprite.root.pivot.set(0, -centerY);
  sprite.root.position.set(player.x, player.y - centerY);
  sprite.root.rotation = (overlay?.rotation ?? 0) + tumbleRoll(player, sprite.metrics.r);
  const sx = pose.bodySx * (overlay?.sx ?? 1);
  const sy = pose.bodySy * (overlay?.sy ?? 1);
  const lean = overlay ? 0 : Math.max(-0.15, Math.min(0.15, player.vx / 2400));
  eachSide(sprite.body, (c) => {
    c.scale.set(sx, sy);
    c.rotation = lean;
  });
}

/** Feet lag the body's squash a little and step while running. */
function placeFeet(sprite: BlobSprite, player: PlayerState, pose: BlobPose): void {
  const { r } = sprite.metrics;
  const lift = footLift(player, r);
  sprite.feet.forEach((foot, i) => {
    const side = i === 0 ? -1 : 1;
    eachSide(foot, (c) => {
      c.position.set(side * 0.45 * r * pose.bodySx, -lift[i]!);
      c.scale.set(pose.feetSx, pose.feetSy);
    });
  });
}

/** Eyes sit under the helmet rim and look toward the aim; the tube pivots toward it. */
function placeFace(sprite: BlobSprite, player: PlayerState, armed: boolean): void {
  const { r, u, helmet } = sprite.metrics;
  sprite.eyes.forEach((eye, i) => {
    const side = i === 0 ? -1 : 1;
    eye.position.set(side * 0.27 * r + player.aimX * 5 * u, 0.12 * r + player.aimY * 2 * u);
    sprite.pupils[i]!.position.set(player.aimX * 1.6 * u, 1.5 * u + player.aimY * 1.2 * u);
  });
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
  placeFeet(sprite, player, pose);
  placeFace(sprite, player, frame.armed);
  const { shadow } = pose;
  sprite.shadow.visible = shadow !== null;
  if (!shadow) return;
  sprite.shadow.position.set(player.x, shadow.y);
  sprite.shadow.scale.set(shadow.width / 2, shadow.height / 2);
  sprite.shadow.alpha = shadow.alpha;
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

/** Matches the layer to the current players and poses them. Call once per rendered frame. */
export function syncPlayersView(
  view: PlayersView,
  players: readonly PlayerState[],
  options: SyncPlayersOptions = {}
): void {
  const nowMs = options.nowMs ?? performance.now();
  const squash = options.squash ?? DEFAULT_GAME_TUNABLES.player.squash;
  for (const player of players) {
    const sprite = spriteFor(view, player);
    noteBlobEvents(sprite.anim, { player, squash, nowMs });
    const pose = blobPose(sprite.anim, { player, squash, nowMs });
    syncInk(sprite, options.zoom ?? 1);
    applyPose(sprite, player, {
      pose,
      overlay: options.overlays?.get(player.id),
      armed: options.armedIds?.has(player.id) === true,
    });
    applyProtection(sprite, options.protectedIds?.has(player.id) === true, nowMs);
  }
  pruneSprites(view, new Set(players.map((player) => player.id)));
}
