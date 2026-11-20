import type { GameTunables } from "@/shared/config/gameTunables";
import { springBackPose, type SquashPose } from "@/shared/utils/easing";
import type { PlayerHitFeel } from "@/features/effects/services/feelCues";

/**
 * The hurt pose (owner, hurt-feedback D1): a hit that takes a chunk squashes the victim wide and
 * springs it back, and squeezes its eyes shut for a moment, whatever the push. Render only; it is
 * laid over whatever pose the blob already wears (a burning hop, a dive), so even a burn tick
 * with no push shows on the body.
 */
export type HurtTunables = GameTunables["feel"]["hurt"];

export interface HurtPose extends SquashPose {
  eyesShut: boolean;
}

/** The hurt pose `ageMs` after the newest hurt, or null once it is over. */
export function hurtPoseAt(ageMs: number, hurt: HurtTunables): HurtPose | null {
  const seconds = ageMs / 1000;
  const longest = Math.max(hurt.squash.seconds, hurt.eyesShutSeconds);
  if (seconds < 0 || seconds >= longest) return null;
  const squash = springBackPose(hurt.squash, seconds / hurt.squash.seconds);
  return { ...squash, eyesShut: seconds < hurt.eyesShutSeconds };
}

/** Hurt poses by player id for this frame (the hits blocked with 0 damage never enter `hits`). */
export function hurtBlobPoses(
  hits: ReadonlyMap<string, PlayerHitFeel>,
  frame: { nowMs: number; hurt: HurtTunables }
): Map<string, HurtPose> {
  const poses = new Map<string, HurtPose>();
  for (const [id, hit] of hits) {
    if (hit.damage <= 0) continue;
    const pose = hurtPoseAt(frame.nowMs - hit.startMs, frame.hurt);
    if (pose) poses.set(id, pose);
  }
  return poses;
}
