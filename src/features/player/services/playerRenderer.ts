import { Container, Graphics } from "pixi.js";
import { GAME_PALETTE } from "@/shared/config/gamePalette";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import {
  blobPose,
  createBlobAnim,
  noteBlobEvents,
  type BlobAnim,
  type BlobPose,
  type BlobPoseOverlay,
  type SquashTunables,
} from "@/features/player/services/blobPose";
import type { PlayerState } from "@/features/player/types/player.types";

/**
 * Player render layer (DESIGN_LANGUAGE § 2–6, "Gumdrop Pop"): one blob per player id — round
 * body with crescent and gloss, two round feet in the body shade, cream helmet with the slot's
 * emblem (● ▲ ■ ✚), eyes toward the aim, ink outline — plus a flat contact shadow. Shapes are
 * drawn once; each frame only sets transforms from `blobPose` (squash, foot deform, shadow).
 *
 * Not yet: zoom-scaled stroke widths, helmet spring wobble, rocket tube (visual-pass / combat).
 */
export interface PlayersView {
  container: Container;
  /** Contact shadows, under every blob. */
  shadows: Container;
  blobs: Container;
  sprites: Map<string, BlobSprite>;
}

interface BlobSprite {
  root: Container;
  body: Container;
  feet: [Graphics, Graphics];
  eyes: [Container, Container];
  pupils: [Graphics, Graphics];
  shadow: Graphics;
  anim: BlobAnim;
  /** Body radius R, world units. */
  radius: number;
}

export interface SyncPlayersOptions {
  /** Animation clock, ms. Defaults to `performance.now()`. */
  nowMs?: number;
  squash?: SquashTunables;
  /** Ability poses by player id (e.g. the dive's headfirst turn), laid over the movement pose. */
  overlays?: ReadonlyMap<string, BlobPoseOverlay>;
}

/** Outline widths, world units (DESIGN_LANGUAGE § 3 at this blob size). */
const STROKE = 2.5;
const STROKE_SMALL = 1.5;
/** Body radius from the collision height: body circle (2R) sits 0.12R above the ground. */
const RADIUS_PER_HEIGHT = 1 / 2.12;

export const createPlayersView = (): PlayersView => {
  const shadows = new Container({ label: "player-shadows" });
  const blobs = new Container({ label: "player-blobs" });
  const container = new Container({ label: "players" });
  container.addChild(shadows, blobs);
  return { container, shadows, blobs, sprites: new Map() };
};

const slotColor = (colors: readonly number[], slot: number): number =>
  colors[slot % colors.length] ?? GAME_PALETTE.ink;

const ink = (width: number) => ({ width, color: GAME_PALETTE.ink, join: "round" as const });

/** Body circle, lower-right crescent in the shade, white gloss, outline. Origin: body centre. */
function drawBody(slot: number, r: number): Graphics {
  return new Graphics()
    .circle(0, 0, r)
    .fill(slotColor(GAME_PALETTE.playerShades, slot))
    .circle(-0.1 * r, -0.1 * r, 0.85 * r)
    .fill(slotColor(GAME_PALETTE.players, slot))
    .ellipse(-0.55 * r, 0.2 * r, 0.14 * r, 0.09 * r)
    .fill({ color: GAME_PALETTE.gloss, alpha: 0.75 })
    .circle(0, 0, r)
    .stroke(ink(STROKE));
}

/** Emblem path per slot: ● ▲ ■ ✚ (the second cue next to colour). */
function emblemPath(g: Graphics, slot: number, s: number): Graphics {
  switch (slot % 4) {
    case 0:
      return g.circle(0, 0, s);
    case 1:
      return g.poly([0, -1.1 * s, 1.05 * s, 0.8 * s, -1.05 * s, 0.8 * s]);
    case 2:
      return g.roundRect(-0.9 * s, -0.9 * s, 1.8 * s, 1.8 * s, 0.25 * s);
    default: {
      const a = 0.38 * s;
      const b = 1.05 * s;
      return g.poly([
        -a,
        -b,
        a,
        -b,
        a,
        -a,
        b,
        -a,
        b,
        a,
        a,
        a,
        a,
        b,
        -a,
        b,
        -a,
        a,
        -b,
        a,
        -b,
        -a,
        -a,
        -a,
      ]);
    }
  }
}

/** Dome over the top 45 % of the body, 4 units wider, gloss stroke and emblem. Origin: body centre. */
function drawHelmet(slot: number, r: number): Graphics {
  const shell = r + 2;
  const rimY = -0.1 * r;
  const rimAngle = Math.asin(-rimY / shell);
  const g = new Graphics()
    .arc(0, 0, shell, Math.PI + rimAngle, Math.PI * 2 - rimAngle)
    .closePath()
    .fill(GAME_PALETTE.helmet)
    .stroke(ink(STROKE))
    .arc(0, 0, shell * 0.72, Math.PI * 1.15, Math.PI * 1.35)
    .stroke({ width: STROKE_SMALL, color: GAME_PALETTE.gloss, cap: "round" });
  const emblem = emblemPath(new Graphics(), slot, 0.26 * r)
    .fill(slotColor(GAME_PALETTE.players, slot))
    .stroke(ink(STROKE_SMALL));
  emblem.position.set(0, -0.6 * r);
  g.addChild(emblem);
  return g;
}

/** One foot, bottom-centre at its origin so it squashes onto the ground. */
const drawFoot = (slot: number, r: number): Graphics =>
  new Graphics()
    .ellipse(0, -0.24 * r, 0.41 * r, 0.24 * r)
    .fill(slotColor(GAME_PALETTE.playerShades, slot))
    .stroke(ink(STROKE));

function drawEye(r: number): { eye: Container; pupil: Graphics } {
  const eye = new Container();
  const white = new Graphics()
    .circle(0, 0, 0.2 * r)
    .fill(GAME_PALETTE.eyeWhite)
    .stroke(ink(STROKE_SMALL));
  const pupil = new Graphics().circle(0, 0, 0.1 * r).fill(GAME_PALETTE.ink);
  eye.addChild(white, pupil);
  return { eye, pupil };
}

function createBlobSprite(player: PlayerState): BlobSprite {
  const r = player.height * RADIUS_PER_HEIGHT;
  const feet: [Graphics, Graphics] = [drawFoot(player.slot, r), drawFoot(player.slot, r)];
  const left = drawEye(r);
  const right = drawEye(r);
  // Body container origin = feet point, so scaling squashes onto the ground.
  const body = new Container();
  const torso = new Container();
  torso.position.set(0, -1.12 * r);
  torso.addChild(drawBody(player.slot, r), left.eye, right.eye, drawHelmet(player.slot, r));
  body.addChild(torso);
  const root = new Container({ label: player.id });
  root.addChild(...feet, body);
  const shadow = new Graphics().ellipse(0, 0, 1, 1).fill(GAME_PALETTE.ink);
  return {
    root,
    body,
    feet,
    eyes: [left.eye, right.eye],
    pupils: [left.pupil, right.pupil],
    shadow,
    anim: createBlobAnim(player),
    radius: r,
  };
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

/** Places and scales the blob. The root turns around the body centre (overlay rotation). */
function placeBlob(
  sprite: BlobSprite,
  player: PlayerState,
  frame: { pose: BlobPose; overlay: BlobPoseOverlay | undefined }
): void {
  const { pose, overlay } = frame;
  // With no overlay this is the plain feet-point placement.
  const centerY = player.height / 2;
  sprite.root.pivot.set(0, -centerY);
  sprite.root.position.set(player.x, player.y - centerY);
  sprite.root.rotation = (overlay?.rotation ?? 0) + tumbleRoll(player, sprite.radius);
  sprite.body.scale.set(pose.bodySx * (overlay?.sx ?? 1), pose.bodySy * (overlay?.sy ?? 1));
  sprite.body.rotation = overlay ? 0 : Math.max(-0.15, Math.min(0.15, player.vx / 2400));
}

function applyPose(
  sprite: BlobSprite,
  player: PlayerState,
  frame: { pose: BlobPose; overlay: BlobPoseOverlay | undefined }
): void {
  const { pose } = frame;
  const r = sprite.radius;
  placeBlob(sprite, player, frame);
  const lift = footLift(player, r);
  sprite.feet.forEach((foot, i) => {
    const side = i === 0 ? -1 : 1;
    foot.position.set(side * 0.48 * r * pose.bodySx, -lift[i]!);
    foot.scale.set(pose.feetSx, pose.feetSy);
  });
  // Eyes sit under the helmet rim and shift / look toward the aim.
  sprite.eyes.forEach((eye, i) => {
    const side = i === 0 ? -1 : 1;
    eye.position.set(side * 0.32 * r + player.aimX * 0.12 * r, 0.22 * r + player.aimY * 0.08 * r);
    sprite.pupils[i]!.position.set(player.aimX * 0.08 * r, player.aimY * 0.08 * r);
  });
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
  view.blobs.addChild(sprite.root);
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
    applyPose(sprite, player, { pose, overlay: options.overlays?.get(player.id) });
  }
  pruneSprites(view, new Set(players.map((player) => player.id)));
}
