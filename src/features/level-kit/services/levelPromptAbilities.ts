import { resolveCatalogEntry } from "@/features/content-catalog/api/contentCatalogApi";
import type { GameTunables } from "@/shared/types/gameTunables.types";
import { MOTION_LIMITS } from "@/shared/utils/levelMotion";

/**
 * Level-prompt lines for the abilities an author sizes a level by (level-prompt-numbers lap):
 * roll, slopes, ice grip, freeze ray, leaving a moving part and the headbutt's hit. Every number
 * is derived from the tunables (or the catalog's ice grip), so the prompt cannot drift from the
 * game. Per level-direction D1 the lines say only what changes where an author places, sizes or
 * spaces shapes. Pure: no DOM.
 */

const round = (n: number): number => Math.round(n);
const degrees = (radians: number): number => round((radians * 180) / Math.PI);
const sinDeg = (deg: number): number => Math.sin((deg * Math.PI) / 180);

/** The ice material's grip (0 = ice … 1 = grippy); frozen ground grips the same (ice-element D5). */
export const iceGrip = (): number => resolveCatalogEntry("material", "ice").entry?.friction ?? 1;

/**
 * Flat distance a roll coasts from `speed`: rolling friction is `decel + drag × v`, both scaled
 * by the ground's grip (A, B), so v(t) = (v0 + A/B)·e^(−Bt) − A/B; it runs until it stops or
 * `roll.maxSeconds` ends it. The tunables' own note: a 1000 roll on the flat stops in ≈ 480 units.
 */
export function rollCoast(t: GameTunables, speed: number, grip = 1): number {
  const a = t.roll.rollingDecel * grip;
  const b = t.roll.rollingDrag * grip;
  const seconds = Math.min(Math.log(1 + (b * speed) / a) / b, t.roll.maxSeconds);
  return ((speed + a / b) * (1 - Math.exp(-b * seconds))) / b - (a / b) * seconds;
}

/** Steady roll speed down a slope of `deg` degrees (gravity along it = rolling friction), 0 if it stops. */
export function rollSlopeSpeed(t: GameTunables, deg: number): number {
  const { rollingDecel: a, rollingDrag: b } = t.roll;
  return Math.max(0, (t.world.gravity * sinDeg(deg) - a) / b);
}

/** The gentlest slope a roll keeps going down by itself, degrees. */
export const rollMinSlope = (t: GameTunables, grip = 1): number =>
  (Math.asin(Math.min(1, (t.roll.rollingDecel * grip) / t.world.gravity)) * 180) / Math.PI;

/** Walking speed on a slope of `deg` degrees, + uphill (slope-walking D8). */
export function slopeWalkSpeed(t: GameTunables, deg: number): number {
  const { runSpeed, slope } = t.player;
  const rise = sinDeg(deg);
  const factor = rise > 0 ? 1 - slope.uphillLoss * rise : 1 - slope.downhillGain * rise;
  return runSpeed * factor;
}

/** Sideways slide from run speed to a stop with no input, at a ground grip. */
export const brakeSlide = (t: GameTunables, grip: number): number =>
  (t.player.runSpeed * t.player.runSpeed) / (2 * t.player.groundDecel * grip);

/** Apex of a jump off a part rising at the ride-speed cap (the part's velocity is kept). */
export const liftJumpApex = (t: GameTunables): number =>
  (t.player.jumpSpeed + MOTION_LIMITS.rideSpeed) ** 2 / (2 * t.world.gravity);

/** Radius of the round ice patch one full freeze-ray charge makes inside a big slab. */
export const freezePatchRadius = (t: GameTunables): number =>
  Math.sqrt((t.ice.freezeAreaPerSecond * t.combat.freezeRay.ammo) / Math.PI);

/** Slopes and the roll: what decides ramps, hills and run-ups. */
export function slopeAndRollLines(t: GameTunables): string[] {
  const { slope, runSpeed } = t.player;
  const { roll, dive } = t;
  return [
    `- Slopes: ground up to \`${degrees(slope.lipAngle)}°\` is walked; steeper is a wall (wall slide and wall jump), except a ledge whose top is within \`${slope.lipRise}\` units, which the blob pulls itself over at \`${round(slope.lipSpeed * runSpeed)}\` units/s. A blob already on a curve keeps its footing up to \`${degrees(slope.restAngle)}°\`, so round tops can be walked over. Walking speed: \`${round(slopeWalkSpeed(t, 30))}\` up a 30° slope, \`${round(slopeWalkSpeed(t, 45))}\` up 45°, \`${round(slopeWalkSpeed(t, -30))}\` down 30° (run \`${runSpeed}\`).`,
    `- Roll: holding fire through a headbutt rolls on at the dive's \`${dive.launchSpeed}\` units/s; a roll from \`${dive.launchSpeed}\` coasts ~\`${round(rollCoast(t, dive.launchSpeed))}\` units on the flat, lasts at most \`${roll.maxSeconds}\` s, keeps rolling down slopes steeper than ~\`${round(rollMinSlope(t))}°\` (~\`${round(rollSlopeSpeed(t, 20))}\` units/s down 20°, ~\`${round(rollSlopeSpeed(t, 30))}\` down 30°) and bounces off terrain. A headbutt out of a fast roll launches at up to \`${dive.rollCarryMax}\` units/s (~\`${round(dive.rollCarryMax * dive.travelSeconds)}\` units of dive). Weapons fired while rolling aim round with the spin, at up to \`${roll.sweepTurnsPerSecond}\` turns/s.`,
  ];
}

/** Ice, frozen ground, leaving a moving part and the headbutt's hit. */
export function groundAndPartLines(t: GameTunables): string[] {
  const grip = iceGrip();
  const leave = MOTION_LIMITS.rideSpeed;
  const pop = (t.dive.attackerPop * t.dive.attackerPop) / (2 * t.world.gravity);
  return [
    `- Ice grip \`${grip}\` (1 = stone): from a run a blob slides ~\`${round(brakeSlide(t, grip))}\` units to a stop on ice (~\`${round(brakeSlide(t, 1))}\` on stone), and a roll from \`${t.dive.launchSpeed}\` coasts ~\`${round(rollCoast(t, t.dive.launchSpeed, grip))}\` on flat ice before its \`${t.roll.maxSeconds}\` s run out, and keeps rolling down any slope over ~\`${Math.max(1, round(rollMinSlope(t, grip)))}°\`. Frozen ground grips like ice.`,
    `- Leaving a moving part (jump, headbutt or walk off) keeps its velocity, up to \`${leave}\` units/s: a jump off a lift rising at full speed peaks ~\`${round(liftJumpApex(t))}\` units up instead of ~\`${round(t.player.jumpSpeed ** 2 / (2 * t.world.gravity))}\`.`,
    `- A headbutt that hits a player pops the diver up ~\`${round(pop)}\` units; a glancing hit on terrain just ends the dive.`,
  ];
}

/** The freeze ray: beam reach, ice patch per charge, thaw and the frozen blob. */
export function freezeRayLine(t: GameTunables): string {
  const ray = t.combat.freezeRay;
  const { ice } = t;
  const area = ice.freezeAreaPerSecond * ray.ammo;
  return `- \`freeze-ray\`: \`${ray.ammo}\` s of beam held on fire, \`${ray.length}\` units long and narrow (±${ray.halfAngleDegrees}°), a light push; it freezes ground at \`${ice.freezeAreaPerSecond}\` units² per second (a full charge ≈ \`${area}\` units²: a round patch ~\`${round(freezePatchRadius(t))}\` units in radius) and the ice thaws after \`${ice.frozenSeconds}\` s or at once under the torch. A blob held in the beam \`${ice.blob.freezeSeconds}\` s (\`${ice.blob.freezeSeconds / ice.blob.crouchChillScale}\` s crouching) is frozen \`${ice.blob.frozenSeconds}\` s and slides with \`${ice.blob.slideGrip}\` grip.`;
}
