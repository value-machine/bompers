import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import {
  blobPose,
  blobShadow,
  createBlobAnim,
  createHelmetWobble,
  crouchFace,
  eventSquash,
  kickHelmetForHit,
  kickHelmetForSquash,
  noteBlobEvents,
  stepCrouchBlend,
  stepHelmetWobble,
  createFeetMotion,
  stepFeetMotion,
  createGroundTilt,
  stepGroundTilt,
} from "@/features/player/services/blobPose";
import { createPlayer } from "@/features/player/services/playerController";
import type { PlayerState } from "@/features/player/types/player.types";

const squash = DEFAULT_GAME_TUNABLES.player.squash;

const standing = (): PlayerState => {
  const player = createPlayer(0, { x: 0, y: 100 }, DEFAULT_GAME_TUNABLES);
  player.grounded = true;
  player.vx = 100;
  return player;
};

describe("blobPose", () => {
  it("should start the full landing squash when a hard landing is counted", () => {
    const player = standing();
    const anim = createBlobAnim(player);
    player.landCount += 1;
    player.lastLandingSpeed = squash.landFullImpact * 2;
    noteBlobEvents(anim, { player, squash, nowMs: 1000 });
    expect(eventSquash(anim, { squash, atMs: 1000 })).toEqual({
      sx: squash.land.sx,
      sy: squash.land.sy,
    });
  });

  it("should squash about half as much when the landing is light", () => {
    const player = standing();
    const anim = createBlobAnim(player);
    player.landCount += 1;
    player.lastLandingSpeed = 120;
    noteBlobEvents(anim, { player, squash, nowMs: 0 });
    const amount = 0.5 + 0.5 * (120 / squash.landFullImpact);
    expect(eventSquash(anim, { squash, atMs: 0 }).sy).toBeCloseTo(
      1 - (1 - squash.land.sy) * amount,
      6
    );
  });

  it("should return to rest after the squash time has passed", () => {
    const player = standing();
    const anim = createBlobAnim(player);
    player.jumpCount += 1;
    noteBlobEvents(anim, { player, squash, nowMs: 0 });
    expect(eventSquash(anim, { squash, atMs: squash.jump.seconds * 1000 })).toEqual({
      sx: 1,
      sy: 1,
    });
  });

  it("should keep the body area roughly constant during the jump stretch", () => {
    const player = standing();
    const anim = createBlobAnim(player);
    player.jumpCount += 1;
    noteBlobEvents(anim, { player, squash, nowMs: 0 });
    const pose = blobPose(anim, { player, squash, nowMs: 0 });
    expect(pose.bodySx * pose.bodySy).toBeGreaterThan(0.94);
    expect(pose.bodySx * pose.bodySy).toBeLessThanOrEqual(1.01);
  });

  it("should not squash when a respawned player settles onto the ground", () => {
    const player = standing();
    const anim = createBlobAnim(player);
    player.landCount += 1;
    player.lastLandingSpeed = 18;
    noteBlobEvents(anim, { player, squash, nowMs: 0 });
    expect(anim.active).toBeNull();
  });

  it("should not squash on the first frame a player is seen", () => {
    const player = standing();
    player.landCount = 3;
    const anim = createBlobAnim(player);
    noteBlobEvents(anim, { player, squash, nowMs: 0 });
    expect(anim.active).toBeNull();
  });

  it("should flatten the feet harder than the body and after a short lag on landing", () => {
    const player = standing();
    const anim = createBlobAnim(player);
    player.landCount += 1;
    player.lastLandingSpeed = squash.landFullImpact;
    noteBlobEvents(anim, { player, squash, nowMs: 0 });
    expect(blobPose(anim, { player, squash, nowMs: 0 }).feetSy).toBe(1);
    const later = blobPose(anim, { player, squash, nowMs: 40 });
    expect(later.feetSy).toBeLessThan(later.bodySy);
  });

  it("should shrink and fade the shadow with height and drop it out of range", () => {
    const player = standing();
    player.grounded = false;
    player.groundBelowY = player.y + 120;
    const half = blobShadow(player);
    expect(half?.alpha).toBeCloseTo(0.14, 6);
    expect(half?.width).toBeCloseTo(1.05 * player.width * 0.75, 6);
    player.groundBelowY = null;
    expect(blobShadow(player)).toBeNull();
  });
});

describe("helmet wobble", () => {
  const helmet = DEFAULT_GAME_TUNABLES.feel.helmet;

  const settle = (wobble: ReturnType<typeof createHelmetWobble>, ms: number) => {
    const drops: number[] = [];
    const tilts: number[] = [];
    for (let t = 0; t <= ms; t += 16) {
      stepHelmetWobble(wobble, { nowMs: t, helmet });
      drops.push(wobble.pose.drop);
      tilts.push(wobble.pose.tilt);
    }
    return { drops, tilts };
  };

  it("should report which squash started when an event is counted", () => {
    const player = standing();
    const anim = createBlobAnim(player);
    expect(noteBlobEvents(anim, { player, squash, nowMs: 0 })).toBeNull();
    player.jumpCount += 1;
    expect(noteBlobEvents(anim, { player, squash, nowMs: 0 })?.kind).toBe("jump");
  });

  it("should sink, bounce back past rest and settle when a landing kicks it", () => {
    const wobble = createHelmetWobble();
    kickHelmetForSquash(wobble, { kind: "land", amount: 1, vx: 0, rolling: false }, helmet);
    const { drops, tilts } = settle(wobble, 1200);
    expect(Math.max(...drops)).toBeGreaterThan(0);
    expect(Math.min(...drops)).toBeLessThan(0);
    expect(Math.abs(drops[drops.length - 1]!)).toBeLessThan(0.05);
    expect(tilts.every((t) => t === 0)).toBe(true);
  });

  it("should tilt toward the push when a hit kicks it, harder for a back hit", () => {
    const front = createHelmetWobble();
    const back = createHelmetWobble();
    kickHelmetForHit(front, { dirX: 1, hard: false }, helmet);
    kickHelmetForHit(back, { dirX: 1, hard: true }, helmet);
    const peakFront = Math.max(...settle(front, 200).tilts);
    const peakBack = Math.max(...settle(back, 200).tilts);
    expect(peakFront).toBeGreaterThan(0);
    expect(peakBack).toBeGreaterThan(peakFront);
  });

  it("should never draw past the caps when kicks pile up", () => {
    const wobble = createHelmetWobble();
    for (let i = 0; i < 10; i += 1) kickHelmetForHit(wobble, { dirX: -1, hard: true }, helmet);
    const { drops, tilts } = settle(wobble, 500);
    expect(Math.max(...drops.map(Math.abs))).toBeLessThanOrEqual(helmet.maxDrop);
    expect(Math.max(...tilts.map(Math.abs))).toBeLessThanOrEqual(helmet.maxTilt);
  });
});

// --- Foot motion ---

const feet = DEFAULT_GAME_TUNABLES.feel.feet;
const R = 12;

const feetPlayer = (patch: Partial<PlayerState> = {}): PlayerState => ({
  ...createPlayer(0, { x: 0, y: 100 }, DEFAULT_GAME_TUNABLES),
  grounded: true,
  ...patch,
});

/** Steps the motion at 60 fps for `ms` more and returns the last pose. */
function run(p: PlayerState, ms: number, motion = createFeetMotion(p)) {
  const start = motion.lastMs === null ? 0 : motion.lastMs + 16;
  let pose = stepFeetMotion(motion, { player: p, feet, r: R, bodySx: 1, nowMs: start });
  for (let t = start + 16; t <= start + ms; t += 16) {
    pose = stepFeetMotion(motion, { player: p, feet, r: R, bodySx: 1, nowMs: t });
  }
  return { pose, motion };
}

describe("stepFeetMotion", () => {
  it("should rest both feet flat and level when standing still", () => {
    const { pose } = run(feetPlayer(), 200);
    expect(pose[0]).toEqual({ x: -0.45 * R, y: 0, rotation: 0 });
    expect(pose[1].x).toBeCloseTo(0.45 * R);
    expect(pose[1].rotation).toBeCloseTo(0);
  });

  it("should lift, swing forward and tip the toe up of the stepping foot when running", () => {
    // Phase π/2 for the left foot: fully lifted, mid-swing.
    const p = feetPlayer({ vx: 340, x: (Math.PI / 2) * feet.stride * R });
    const { pose } = run(p, 0);
    expect(pose[0].y).toBeCloseTo(-feet.stepLift * R);
    expect(pose[0].rotation).toBeCloseTo(-feet.stepTilt);
    expect(pose[1].y).toBeCloseTo(0);
    expect(pose[1].rotation).toBeCloseTo(0);
  });

  it("should swing the lifted foot forward when running left", () => {
    const at = (x: number) => {
      const p = feetPlayer({ vx: -340, x });
      return run(p, 0).pose[0].x;
    };
    // Running left, x falls from phase π·0.75 to π·0.25 while the left foot is lifted.
    const early = at(0.75 * Math.PI * feet.stride * R);
    const late = at(0.25 * Math.PI * feet.stride * R);
    expect(late).toBeLessThan(early);
  });

  it("should turn both soles toward the wall when sliding on a right wall", () => {
    const { pose } = run(feetPlayer({ grounded: false, wallDir: 1, vy: 120 }), 300);
    for (const foot of pose) {
      expect(foot.rotation).toBeCloseTo(-Math.PI / 2);
      expect(foot.x).toBeCloseTo(feet.wallX * R);
    }
    // The near (right) foot sits higher than the far one.
    expect(pose[1].y).toBeLessThan(pose[0].y);
  });

  it("should keep the feet on the wall just after a wall-jump and let go after the hold", () => {
    const p = feetPlayer({ grounded: false, wallDir: -1, lastWallDir: -1 });
    const { motion } = run(p, 300);
    p.wallDir = 0;
    p.wallJumpCount += 1;
    p.vx = 300;
    const t0 = 316;
    const held = stepFeetMotion(motion, { player: p, feet, r: R, bodySx: 1, nowMs: t0 });
    expect(held[0].rotation).toBeCloseTo(Math.PI / 2);
    let pose = held;
    for (let t = t0 + 16; t <= t0 + 600; t += 16) {
      pose = stepFeetMotion(motion, { player: p, feet, r: R, bodySx: 1, nowMs: t });
    }
    expect(motion.wall).toBe(0);
    expect(Math.abs(pose[0].rotation)).toBeLessThan(1);
  });

  it("should not turn the feet when the render clock jumps back", () => {
    const { motion } = run(feetPlayer(), 200);
    const pose = stepFeetMotion(motion, { player: feetPlayer(), feet, r: R, bodySx: 1, nowMs: 0 });
    expect(motion.wall).toBe(0);
    expect(pose[0].rotation).toBeCloseTo(0);
  });

  it("should spread the feet outward after a hard landing and settle back", () => {
    const p = feetPlayer();
    const { motion } = run(p, 100);
    p.landCount += 1;
    p.lastLandingSpeed = 900;
    const { pose } = run(p, 50, motion);
    expect(pose[1].x).toBeGreaterThan(0.45 * R);
    expect(pose[0].x).toBeLessThan(-0.45 * R);
    const settled = run(p, 1500, motion).pose;
    expect(settled[1].x).toBeCloseTo(0.45 * R, 1);
  });

  it("should tilt the feet behind the motion when flying sideways", () => {
    const { pose } = run(feetPlayer({ grounded: false, vx: 900, vy: 0 }), 600);
    expect(pose[0].rotation).toBeCloseTo(-feet.airTilt, 1);
    expect(pose[1].rotation).toBeCloseTo(-feet.airTilt, 1);
  });
});

describe("crouch pose", () => {
  const crouch = DEFAULT_GAME_TUNABLES.player.crouch;

  it("should sink the body and keep the feet once the crouch has eased in", () => {
    const player = standing();
    const anim = createBlobAnim(player);
    player.crouching = true;
    stepCrouchBlend(anim, { player, crouch, nowMs: 0 });
    stepCrouchBlend(anim, { player, crouch, nowMs: crouch.easeSeconds * 500 });
    expect(anim.crouchBlend).toBeCloseTo(0.5, 6);
    stepCrouchBlend(anim, { player, crouch, nowMs: crouch.easeSeconds * 1000 });
    const pose = blobPose(anim, { player, squash, nowMs: 0, crouch });
    expect(pose.bodySy).toBeCloseTo(crouch.bodySy, 6);
    expect(pose.bodySx).toBeCloseTo(crouch.bodySx, 6);
    expect(pose.feetSy).toBe(1);
    expect(pose.feetSx).toBe(1);
  });

  it("should stand back up when the crouch ends", () => {
    const player = standing();
    player.crouching = true;
    const anim = createBlobAnim(player);
    player.crouching = false;
    stepCrouchBlend(anim, { player, crouch, nowMs: 0 });
    stepCrouchBlend(anim, { player, crouch, nowMs: 1000 });
    expect(anim.crouchBlend).toBe(0);
    expect(blobPose(anim, { player, squash, nowMs: 0, crouch }).bodySy).toBe(1);
  });
});

describe("crouch face", () => {
  const crouch = DEFAULT_GAME_TUNABLES.player.crouch;

  it("should lower the helmet, lift the eyes and tuck them under the dome when crouched", () => {
    const player = standing();
    player.crouching = true;
    const anim = createBlobAnim(player);
    expect(crouchFace(anim, crouch)).toEqual({
      helmetDrop: crouch.helmetDrop,
      eyeLift: crouch.eyeLift,
      eyesUnderHelmet: true,
    });
  });

  it("should keep the standing face when not crouching", () => {
    const anim = createBlobAnim(standing());
    expect(crouchFace(anim, crouch)).toEqual({
      helmetDrop: 0,
      eyeLift: 0,
      eyesUnderHelmet: false,
    });
  });
});

describe("stepGroundTilt", () => {
  const tunables = DEFAULT_GAME_TUNABLES.feel.groundTilt;
  const DEG = Math.PI / 180;
  /** Lean after standing `seconds` on ground of `slope` radians (60 fps). */
  const settle = (slope: number, grounded = true, seconds = 2): number => {
    const tilt = createGroundTilt();
    let lean = 0;
    for (let ms = 0; ms <= seconds * 1000; ms += 1000 / 60) {
      lean = stepGroundTilt(tilt, { groundAngle: slope, grounded, nowMs: ms, tunables });
    }
    return lean;
  };

  it("should lean into the hill by the share of the slope when standing on it", () => {
    expect(settle(20 * DEG)).toBeCloseTo(-tunables.share * 20 * DEG, 3);
    expect(settle(-20 * DEG)).toBeCloseTo(tunables.share * 20 * DEG, 3);
  });

  it("should cap the lean at the max angle when the slope is steep", () => {
    expect(settle(70 * DEG)).toBeCloseTo(-tunables.maxAngle, 3);
  });

  it("should stay level when airborne", () => {
    expect(settle(40 * DEG, false)).toBeCloseTo(0, 6);
  });

  it("should ease into a new slope instead of snapping when the ground angle changes", () => {
    const tilt = createGroundTilt();
    stepGroundTilt(tilt, { groundAngle: 0, grounded: true, nowMs: 0, tunables });
    const first = stepGroundTilt(tilt, {
      groundAngle: 30 * DEG,
      grounded: true,
      nowMs: 16,
      tunables,
    });
    expect(Math.abs(first)).toBeLessThan(tunables.share * 30 * DEG * 0.5);
  });
});
