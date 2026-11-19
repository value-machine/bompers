import { Graphics } from "pixi.js";
import { GAME_PALETTE } from "@/shared/config/gamePalette";
import type { Vec2 } from "@/shared/types/gameGeometry.types";
import { helmetPoint } from "@/features/combat/api/combatApi";
import { PANIC_PUPIL_SCALE, type BlobPoseOverlay } from "@/features/blob-look/api/blobLookApi";
import type { PlayerState } from "@/features/player/api/playerApi";
import type { BlobFireMoment, BlobFireState } from "@/features/blob-fire/types/blobFire.types";

/**
 * The burning-blob look (owner fire-burn D1, the options page's variant 2 with variant 1's
 * drawn hops): panic hops drawn over the sim body (it never leaves the ground for them),
 * pinprick pupils, helmet flames and flying sweat drops; and the moments: a flame pop on
 * catching, steam puffs off ice, flames blown back by a dive, a flame arc leaping to the bumped
 * rival, and smoke when it burns down. All render only.
 */
const COLORS = GAME_PALETTE.fire;
/** Drawn panic hops: one every `period` s, `height` units, a light squash at each touch-down. */
const HOP = { period: 0.4, height: 5, squash: 0.08 };

/** 0 on the ground … 1 at the top of a drawn hop (each blob hops out of step with the others). */
const hopPhase = (nowMs: number, slot: number): number =>
  Math.abs(Math.sin((nowMs / 1000 / HOP.period + slot * 0.37) * Math.PI));

/** Pose overlay per burning blob (by player id): the drawn hop and pinprick pupils. */
export function burningBlobPoses(
  blobFire: BlobFireState,
  frame: { players: readonly PlayerState[]; nowMs: number }
): Map<string, BlobPoseOverlay> {
  const poses = new Map<string, BlobPoseOverlay>();
  for (const player of frame.players) {
    if (!blobFire.blobs.has(player.id)) continue;
    const up = hopPhase(frame.nowMs, player.slot);
    // Squashed at the touch-down, stretched a touch at the top; the area stays in the juice band.
    const squash = HOP.squash * (1 - 2 * up);
    poses.set(player.id, {
      rotation: 0,
      sx: 1 + squash,
      sy: 1 - squash,
      lift: up * HOP.height,
      pupilScale: PANIC_PUPIL_SCALE,
    });
  }
  return poses;
}

export interface BlobFireFrame {
  blobFire: BlobFireState;
  players: readonly PlayerState[];
  nowMs: number;
  /** Sim time, seconds (moment ages). */
  timeSeconds: number;
  /** How long a moment shows (`fire.blob.momentSeconds`). */
  momentSeconds: number;
}

/** Flames licking up from the helmet, and two sweat drops flicking off the sides. */
function drawBurning(g: Graphics, player: PlayerState, nowMs: number): void {
  const lift = hopPhase(nowMs, player.slot) * HOP.height;
  const top = helmetPoint(player);
  const at = { x: top.x, y: top.y - lift - player.height * 0.12 };
  for (let i = 0; i < 3; i += 1) {
    const flick = 0.8 + 0.2 * Math.sin(nowMs * 0.02 + i * 2.1 + player.slot);
    const x = at.x + (i - 1) * 5;
    const h = (i === 1 ? 14 : 9) * flick;
    g.ellipse(x, at.y - h / 2, 3.5 * flick, h / 2).fill({ color: COLORS.outer, alpha: 0.9 });
    g.ellipse(x, at.y - h / 3, 1.8 * flick, h / 3).fill({ color: COLORS.core });
  }
  const t = (nowMs / 1000 / HOP.period) % 1;
  for (const side of [-1, 1]) {
    const x = player.x + side * (player.width / 2 + 3 + t * 6);
    const y = player.y - player.height * 0.7 - lift - t * 4 + t * t * 10;
    g.circle(x, y, 1.8).fill({ color: COLORS.sweat, alpha: 1 - t });
  }
}

const puffs = (g: Graphics, from: Vec2, look: { color: number; k: number; rise: number }) => {
  const { color, k, rise } = look;
  for (let i = 0; i < 4; i += 1) {
    const x = from.x + (i - 1.5) * 6 * (1 + k);
    const y = from.y - 6 - rise * k - (i % 2) * 4;
    g.circle(x, y, 3 + 4 * k).fill({ color, alpha: 0.7 * (1 - k) });
  }
};

/** One moment's effect at age fraction `k` (0 → 1). */
function drawMoment(g: Graphics, moment: BlobFireMoment, k: number): void {
  const { at } = moment;
  if (moment.kind === "caught") {
    g.circle(at.x, at.y, 8 + 14 * k).fill({ color: COLORS.mid, alpha: 0.6 * (1 - k) });
  } else if (moment.kind === "steam") {
    puffs(g, at, { color: COLORS.steam, k, rise: 24 });
  } else if (moment.kind === "smoke") {
    puffs(g, at, { color: COLORS.smoke, k, rise: 18 });
  } else if (moment.kind === "blown") {
    for (let i = 0; i < 4; i += 1) {
      const a = -Math.PI / 2 + (i - 1.5) * 0.6;
      const d = 6 + 22 * k;
      g.circle(at.x + Math.cos(a) * d, at.y - 6 + Math.sin(a) * d, 3 * (1 - k)).fill({
        color: COLORS.outer,
      });
    }
  } else if (moment.to) {
    // Leap: a flame ball arcing from the passer to the rival over the first half.
    const s = Math.min(1, k * 2);
    const x = at.x + (moment.to.x - at.x) * s;
    const y = at.y + (moment.to.y - at.y) * s - Math.sin(s * Math.PI) * 18;
    g.circle(x, y, 5 * (1 - k * 0.5)).fill({ color: COLORS.outer, alpha: 0.9 });
    g.circle(x, y, 2.5).fill({ color: COLORS.core });
  }
}

/** The burning blobs' layer: add above the players, over the torch sprays. */
export interface BlobFireView {
  layer: Graphics;
}

export const createBlobFireView = (): BlobFireView => ({
  layer: new Graphics({ label: "burning-blobs" }),
});

/** Draws the burning blobs' flames and sweat, and the recent burning-blob moments. */
export function syncBlobFireView(view: BlobFireView, frame: BlobFireFrame): void {
  const g = view.layer.clear();
  for (const player of frame.players) {
    if (frame.blobFire.blobs.has(player.id)) drawBurning(g, player, frame.nowMs);
  }
  for (const moment of frame.blobFire.blobMoments) {
    const k = (frame.timeSeconds - moment.atSeconds) / frame.momentSeconds;
    if (k >= 0 && k <= 1) drawMoment(g, moment, k);
  }
}
