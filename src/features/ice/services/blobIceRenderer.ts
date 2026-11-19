import type { Graphics } from "pixi.js";
import { GAME_PALETTE } from "@/shared/config/gamePalette";
import type { GameTunables } from "@/shared/types/gameTunables.types";
import { inkColor } from "@/shared/utils/debugInk";
import type { Vec2 } from "@/shared/types/gameGeometry.types";
import type { BlobPoseOverlay } from "@/features/blob-look/api/blobLookApi";
import type { PlayerState } from "@/features/player/api/playerApi";
import { CRACK_HOP_SECONDS } from "@/features/ice/services/frozenBlobs";
import type { IceBlob, IceBlobMoment, IceState } from "@/features/ice/types/ice.types";

/**
 * The ice block's look (owner, ice-frozen-blobs D1, D8; the options page's B): a glossy rounded
 * cube in the ice colours around a frozen blob, ink first and colour on top, with a crack line
 * per jump press; the blob inside has pinprick pupils and hops a little on each crack. While the
 * chill builds the cube forms around the blob. Moments: a white pop when it freezes, chips on a
 * crack, shards when it breaks, steam when fire melts it. All render only.
 */
const COLORS = GAME_PALETTE.ice;
const INK = inkColor("ice");

export const BLOCK_LOOK = {
  /** The cube's margin around the blob's body box, and its corner radius, world units. */
  margin: 5,
  radius: 6,
  /** See-through enough to show the blob inside. */
  fillAlpha: 0.55,
  /** Height of a crack's drawn hop, world units. */
  hopHeight: 4,
  frozenPupilScale: 0.45,
  /** The freeze pop clears in this share of a moment's time (inside the effect window). */
  popShare: 0.5,
  shards: 8,
} as const;

/** 0 → 1 → 0 over a crack's hop; 0 outside it. */
const crackHop = (blob: IceBlob, timeSeconds: number): number => {
  const u = (timeSeconds - blob.crackedAt) / CRACK_HOP_SECONDS;
  return u <= 0 || u >= 1 ? 0 : Math.sin(u * Math.PI);
};

/** Pose overlay per frozen blob (by player id): pinprick pupils and the drawn hop of a crack. */
export function frozenBlobPoses(
  ice: IceState,
  frame: { players: readonly PlayerState[]; timeSeconds: number }
): Map<string, BlobPoseOverlay> {
  const poses = new Map<string, BlobPoseOverlay>();
  for (const player of frame.players) {
    const blob = ice.blobs.get(player.id);
    if (!blob || blob.frozenAt === null) continue;
    poses.set(player.id, {
      rotation: 0,
      sx: 1,
      sy: 1,
      lift: crackHop(blob, frame.timeSeconds) * BLOCK_LOOK.hopHeight,
      pupilScale: BLOCK_LOOK.frozenPupilScale,
    });
  }
  return poses;
}

export interface BlockBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The cube around a blob: its body box grown by the margin, scaled about the body centre. */
export function blockBox(player: PlayerState, look: { scale: number; lift: number }): BlockBox {
  const w = (player.width + BLOCK_LOOK.margin * 2) * look.scale;
  const h = (player.height + BLOCK_LOOK.margin * 2) * look.scale;
  const cy = player.y - player.height / 2 - look.lift;
  return { x: player.x - w / 2, y: cy - h / 2, w, h };
}

/** Crack lines across the cube, one per press, as fractions of its box. */
const CRACKS: readonly (readonly [number, number])[][] = [
  [
    [0, 0.45],
    [0.3, 0.55],
    [0.22, 0.8],
    [0.45, 1],
  ],
  [
    [1, 0.3],
    [0.72, 0.4],
    [0.82, 0.15],
    [0.58, 0],
  ],
  [
    [0.4, 0],
    [0.3, 0.3],
    [0.52, 0.42],
    [0.3, 0.55],
  ],
];

/** The crack polylines of a cube with `count` presses in it, in world units. */
export function crackLines(box: BlockBox, count: number): Vec2[][] {
  return CRACKS.slice(0, Math.max(0, count)).map((line) =>
    line.map(([fx, fy]) => ({ x: box.x + fx * box.w, y: box.y + fy * box.h }))
  );
}

/** One flying shard: a small triangle at age fraction `k` (0 → 1) of the break. */
export function shardTriangle(center: Vec2, index: number, k: number): Vec2[] {
  const angle = (index / BLOCK_LOOK.shards) * Math.PI * 2 + 0.3;
  const reach = 8 + 30 * k * (2 - k);
  const size = 5 * (1 - k) + 1;
  const at = {
    x: center.x + Math.cos(angle) * reach,
    y: center.y + Math.sin(angle) * reach * 0.8 + k * k * 14,
  };
  const spin = angle + k * 4;
  return [0, 2.2, 4.2].map((corner) => ({
    x: at.x + Math.cos(spin + corner) * size,
    y: at.y + Math.sin(spin + corner) * size,
  }));
}

function drawCube(g: Graphics, box: BlockBox, look: { ink: number; alpha: number }): void {
  const r = Math.min(BLOCK_LOOK.radius, box.w / 3);
  g.roundRect(box.x, box.y, box.w, box.h, r).stroke({
    width: look.ink * 2,
    color: INK,
    alpha: look.alpha,
    join: "round",
  });
  g.roundRect(box.x, box.y, box.w, box.h, r).fill({
    color: COLORS.body,
    alpha: BLOCK_LOOK.fillAlpha * look.alpha,
  });
  // The lighter top, as on frozen ground, and two gloss streaks.
  g.roundRect(box.x + 2, box.y + 2, box.w - 4, Math.min(5, box.h / 4), 2).fill({
    color: COLORS.lip,
    alpha: 0.85 * look.alpha,
  });
  g.moveTo(box.x + box.w * 0.2, box.y + box.h * 0.22).lineTo(
    box.x + box.w * 0.1,
    box.y + box.h * 0.5
  );
  g.moveTo(box.x + box.w * 0.88, box.y + box.h * 0.62).lineTo(
    box.x + box.w * 0.8,
    box.y + box.h * 0.84
  );
  g.stroke({ width: 3, color: COLORS.gloss, alpha: 0.8 * look.alpha, cap: "round" });
}

function drawCracks(g: Graphics, box: BlockBox, count: number): void {
  const lines = crackLines(box, count);
  for (const line of lines) {
    line.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)));
  }
  if (lines.length > 0) g.stroke({ width: 2, color: INK, cap: "round", join: "round" });
}

function drawShards(g: Graphics, center: Vec2, look: { k: number; ink: number }): void {
  for (let i = 0; i < BLOCK_LOOK.shards; i += 1) {
    const points = shardTriangle(center, i, look.k);
    g.poly(points).fill(INK).stroke({ width: look.ink, color: INK, join: "round" });
    g.poly(points).fill(i % 2 === 0 ? COLORS.body : COLORS.lip);
  }
}

/** One moment's effect at age fraction `k` (0 → 1). */
function drawMoment(g: Graphics, moment: IceBlobMoment, look: { k: number; ink: number }): void {
  const { at } = moment;
  const { k } = look;
  if (moment.kind === "frozen") {
    const pop = k / BLOCK_LOOK.popShare;
    if (pop < 1) {
      g.circle(at.x, at.y, 14 + 18 * pop).stroke({
        width: 4 * (1 - pop) + 1,
        color: COLORS.gloss,
        alpha: 1 - pop,
      });
    }
  } else if (moment.kind === "shatter") {
    drawShards(g, at, look);
  } else if (moment.kind === "crack") {
    for (let i = 0; i < 3; i += 1) {
      const x = at.x + (i - 1) * 9 * (1 + k);
      const y = at.y - 14 - 16 * k * (2 - k) + k * k * 12;
      g.circle(x, y, 2.5 * (1 - k) + 0.5).fill(COLORS.lip);
    }
  } else {
    // Melt: steam, as when ice puts a burning blob out.
    for (let i = 0; i < 4; i += 1) {
      const x = at.x + (i - 1.5) * 6 * (1 + k);
      g.circle(x, at.y - 6 - 24 * k - (i % 2) * 4, 3 + 4 * k).fill({
        color: COLORS.gloss,
        alpha: 0.7 * (1 - k),
      });
    }
  }
}

export interface BlobIceFrame {
  ice: IceState;
  players: readonly PlayerState[];
  /** Sim time, seconds (hop and moment ages). */
  timeSeconds: number;
  blob: GameTunables["ice"]["blob"];
  /** Effect outline width this frame, world units. */
  ink: number;
}

/** Draws the cubes (forming or frozen) over the blobs, and the recent frozen-blob moments. */
export function drawBlobIce(g: Graphics, frame: BlobIceFrame): void {
  for (const player of frame.players) {
    const blob = frame.ice.blobs.get(player.id);
    if (!blob) continue;
    if (blob.frozenAt === null) {
      // Forming: the cube grows in around the blob as the chill fills.
      const k = Math.min(1, blob.chill / frame.blob.freezeSeconds);
      drawCube(g, blockBox(player, { scale: 0.5 + 0.5 * k, lift: 0 }), {
        ink: frame.ink,
        alpha: k,
      });
      continue;
    }
    const lift = crackHop(blob, frame.timeSeconds) * BLOCK_LOOK.hopHeight;
    const box = blockBox(player, { scale: 1, lift });
    drawCube(g, box, { ink: frame.ink, alpha: 1 });
    drawCracks(g, box, blob.cracks);
  }
  for (const moment of frame.ice.blobMoments) {
    const k = (frame.timeSeconds - moment.atSeconds) / frame.blob.momentSeconds;
    if (k >= 0 && k <= 1) drawMoment(g, moment, { k, ink: frame.ink });
  }
}
