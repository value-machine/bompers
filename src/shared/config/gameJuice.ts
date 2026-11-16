/**
 * Game juice scale — the SSOT every piece of game feedback picks from (guideline:
 * `documentation/game/GAME_JUICE.md`). Values that already exist stay where they live (the
 * `feel` and `player.squash` tunables, the sound bank, renderer constants) and read from or
 * conform to this scale; `gameJuice.test.ts` checks the tunables against it.
 *
 * - **Tiers** set how loud every visual channel is for one game moment. A moment picks a tier
 *   instead of inventing its own shake or flash numbers.
 * - **Windows** bound how long each kind of feedback lasts (seconds, 60 fps = 16.7 ms a frame).
 * - **Squash** bounds every squash / stretch pose so the blob keeps its volume.
 */

/** One impact tier: what each visual channel does at full strength (render only). */
export interface JuiceTier {
  /** Camera shake kick, screen px (0 = none). */
  shakePx: number;
  /** Peak white flash alpha on the body that takes it (0 = none). */
  flash: number;
  /** Render-only freeze of the world view, seconds (0 = none). */
  hitStopSeconds: number;
  /** Whether the moment's sound ducks the music bus (sound bank `DUCKING_SOUNDS`). */
  ducksMusic: boolean;
}

export type JuiceTierName = "light" | "medium" | "heavy";

/**
 * - `light`: the player's own actions (jump, land, fire, pickup, respawn) — squash and sound only.
 * - `medium`: something hit you or you bounced (front hit, tumble bounce).
 * - `heavy`: the big moments (back hit, explosion) — strongest shake, full flash, hit-stop.
 */
export const JUICE_TIERS: Readonly<Record<JuiceTierName, JuiceTier>> = {
  light: { shakePx: 0, flash: 0, hitStopSeconds: 0, ducksMusic: false },
  medium: { shakePx: 3, flash: 0.75, hitStopSeconds: 0, ducksMusic: false },
  heavy: { shakePx: 6, flash: 1, hitStopSeconds: 0.05, ducksMusic: true },
};

/** Summed shake never exceeds this many screen px, however many kicks overlap. */
export const JUICE_SHAKE_CAP_PX = 12;

/** Inclusive [min, max] seconds. */
export type JuiceWindow = readonly [min: number, max: number];

export type JuiceRole = "flash" | "fade" | "shake" | "squash" | "effect" | "linger";

/**
 * How long each kind of feedback lasts. Short and snappy: nothing a player must wait on.
 * - `flash`: full-strength flash hold, hit-stop (2–4 frames).
 * - `fade`: a flash fading out.
 * - `shake`: one camera-shake kick.
 * - `squash`: a squash / stretch recovering to rest, a HUD pip pop.
 * - `effect`: a pop-in effect clearing (explosion star, impact pop).
 * - `linger`: things that fly off (debris, droplets, confetti).
 */
export const JUICE_WINDOWS: Readonly<Record<JuiceRole, JuiceWindow>> = {
  flash: [0.03, 0.07],
  fade: [0.05, 0.15],
  shake: [0.06, 0.15],
  squash: [0.1, 0.2],
  effect: [0.18, 0.32],
  linger: [0.3, 0.6],
};

/**
 * Squash and stretch keep the blob's volume: body scale `sx · sy` stays inside the area band
 * (DESIGN_LANGUAGE § 6), and each axis stays in [`minScale`, `maxScale`] (the land pose is the
 * limit both ways: 1.25 × 0.75).
 */
export const JUICE_SQUASH = {
  minArea: 0.93,
  maxArea: 1.01,
  minScale: 0.75,
  maxScale: 1.25,
} as const;

/** True when `seconds` lies in the role's window. */
export function isInJuiceWindow(role: JuiceRole, seconds: number): boolean {
  const [min, max] = JUICE_WINDOWS[role];
  return seconds >= min && seconds <= max;
}

/** True when a squash pose (sx, sy) keeps the volume and the stretch limit. */
export function isJuiceSquash(pose: { sx: number; sy: number }): boolean {
  const { minArea, maxArea, minScale, maxScale } = JUICE_SQUASH;
  const area = pose.sx * pose.sy;
  const axisOk = (scale: number): boolean => scale >= minScale && scale <= maxScale;
  return area >= minArea && area <= maxArea && axisOk(pose.sx) && axisOk(pose.sy);
}
