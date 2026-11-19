import { Container, Graphics } from "pixi.js";
import { GAME_PALETTE } from "@/shared/config/gamePalette";
import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { BlobPoseOverlay } from "@/features/blob-look/api/blobLookApi";
import type { DiveState, RecentHit } from "@/features/dive/types/dive.types";
import { RECENT_HIT_SECONDS } from "@/features/dive/services/diveSim";
import { diveBlobPose } from "@/features/dive/services/divePose";

/**
 * Dive render pieces: the impact pops (world effects layer, drawn under the players per
 * DESIGN_LANGUAGE § 5) and the pose overlays the player layer applies.
 */
export interface DiveView {
  /** World layer: impact pops. */
  effects: Container;
  pops: Graphics[];
}

/**
 * Impact pop (DESIGN_LANGUAGE § 6: effects pop in at full size on frame 1, then shrink): a
 * flat disc that shrinks away, an ink ring that runs outward, and short spokes flying off.
 * Back hits are bigger and yellow.
 */
const POP = { discRadius: 26, ringFrom: 18, ringTo: 52, spokes: 8, spokeLength: 12 };
const STRONG_SCALE = 1.35;

export const createDiveView = (): DiveView => ({
  effects: new Container({ label: "dive-effects" }),
  pops: [],
});

/** Pose overlays by player id for `syncPlayersView`. */
export function diveBlobPoses(
  dive: DiveState,
  tunables: GameTunables
): Map<string, BlobPoseOverlay> {
  const poses = new Map<string, BlobPoseOverlay>();
  for (const [id, motion] of Object.entries(dive.motions)) {
    const pose = diveBlobPose(motion, tunables.dive);
    if (pose) poses.set(id, pose);
  }
  return poses;
}

function popAt(view: DiveView, index: number): Graphics {
  const existing = view.pops[index];
  if (existing) return existing;
  const pop = new Graphics();
  view.pops.push(pop);
  view.effects.addChild(pop);
  return pop;
}

function drawSpokes(
  pop: Graphics,
  spokes: { at: { x: number; y: number }; reach: number; t: number }
): void {
  const { at, reach, t } = spokes;
  const length = POP.spokeLength * (1 - t);
  for (let i = 0; i < POP.spokes; i += 1) {
    const angle = (i / POP.spokes) * Math.PI * 2 + 0.2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    pop
      .moveTo(at.x + cos * reach, at.y + sin * reach)
      .lineTo(at.x + cos * (reach + length), at.y + sin * (reach + length));
  }
  pop.stroke({ width: 3, color: GAME_PALETTE.ink, alpha: 1 - t, cap: "round" });
}

function drawPop(pop: Graphics, recent: RecentHit): void {
  const { hit } = recent;
  const t = Math.min(1, recent.ageSeconds / RECENT_HIT_SECONDS);
  const strong = hit.zone === "back";
  const size = strong ? STRONG_SCALE : 1;
  const at = hit.contactPoint;
  const ring = (POP.ringFrom + (POP.ringTo - POP.ringFrom) * (1 - (1 - t) * (1 - t))) * size;
  pop
    .clear()
    .circle(at.x, at.y, POP.discRadius * size * (1 - t))
    .fill(strong ? GAME_PALETTE.hitStrong : GAME_PALETTE.hitFlash)
    .stroke({ width: 3, color: GAME_PALETTE.ink })
    .circle(at.x, at.y, ring)
    .stroke({ width: 4 * (1 - t) + 0.5, color: GAME_PALETTE.ink, alpha: 1 - t });
  drawSpokes(pop, { at, reach: ring + 4, t });
  pop.visible = true;
}

/** Draws the dive effects for the latest state. Call once per rendered frame. */
export function syncDiveView(view: DiveView, dive: DiveState): void {
  dive.recentHits.forEach((recent, index) => drawPop(popAt(view, index), recent));
  for (let i = dive.recentHits.length; i < view.pops.length; i += 1) view.pops[i]!.visible = false;
}
