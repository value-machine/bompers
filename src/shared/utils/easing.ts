/**
 * Easing curves and squash-pose helpers every render-only pose shares (GAME_JUICE § 4): the blob,
 * the dive, the weapon barrel and the pickups. `t` runs 0 → 1 over the move.
 */

/** Fast start, soft landing. */
export const easeOutQuad = (t: number): number => 1 - (1 - t) * (1 - t);

/** Back-out: overshoots a little past 1 before settling (pop-ins, springs off a hit). */
export const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  return 1 + (c1 + 1) * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};

export interface SquashPose {
  sx: number;
  sy: number;
}

/** `pose` at `amount` 1, rest (1 × 1) at `amount` 0. */
export const blendPose = (pose: SquashPose, amount: number): SquashPose => ({
  sx: 1 + (pose.sx - 1) * amount,
  sy: 1 + (pose.sy - 1) * amount,
});

/**
 * A pose struck at `t` 0 that springs back to rest with a small overshoot by `t` 1 (a shot's
 * barrel pop, a pickup settling). Outside [0, 1) it is at rest.
 */
export const springBackPose = (pose: SquashPose, t: number): SquashPose =>
  t < 0 || t >= 1 ? { sx: 1, sy: 1 } : blendPose(pose, 1 - easeOutBack(t));

/** Scale of something popping in over `t` 0 → 1: from nothing, overshooting, to full size. */
export const popInScale = (t: number): number => (t >= 1 ? 1 : easeOutBack(Math.max(0, t)));
