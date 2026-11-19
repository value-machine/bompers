import { describe, expect, it } from "vitest";
import { isJuiceSquash } from "@/shared/config/gameJuice";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import {
  barrelPopScale,
  blobPose,
  blobShadow,
  createBlobAnim,
  createHelmetWobble,
  eventSquash,
  kickHelmetForHit,
  kickHelmetForSquash,
  noteBlobEvents,
  stepHelmetWobble,
  createFeetMotion,
  stepFeetMotion,
  createGroundTilt,
  stepGroundTilt,
  createContactHold,
  stepContactHold,
} from "@/features/player/services/blobPose";
import { noteCrouch, STANDING_SINK } from "@/features/player/services/crouchPose";
import { EMPTY_PLAYER_INPUT } from "@/shared/utils/gameInputMapping";
import { buildTerrainFromLevel } from "@/features/arena/api/arenaApi";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import { createPlayer, stepPlayers } from "@/features/player/services/playerController";
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
    const deepest = 1000 + squash.land.sinkSeconds[1] * 1000;
    expect(eventSquash(anim, { squash, atMs: deepest }).sx).toBeCloseTo(squash.land.sx, 6);
    expect(eventSquash(anim, { squash, atMs: deepest }).sy).toBeCloseTo(squash.land.sy, 6);
  });

  it("should squash only the minimum amount when the landing is barely counted", () => {
    const player = standing();
    const anim = createBlobAnim(player);
    player.landCount += 1;
    player.lastLandingSpeed = 120;
    noteBlobEvents(anim, { player, squash, nowMs: 0 });
    const impact = 120 / squash.landFullImpact;
    const amount = squash.landMinAmount + (1 - squash.landMinAmount) * impact;
    expect(anim.active?.amount).toBeCloseTo(amount, 6);
  });

  it("should keep the landing squash moving across many frames when the drop is big", () => {
    const player = standing();
    const anim = createBlobAnim(player);
    player.landCount += 1;
    player.lastLandingSpeed = squash.landFullImpact;
    noteBlobEvents(anim, { player, squash, nowMs: 0 });
    const frames = Array.from({ length: 40 }, (_, n) =>
      eventSquash(anim, { squash, atMs: (n * 1000) / 60 })
    );
    const moving = frames.filter((pose) => Math.abs(pose.sy - 1) > 0.005).length;
    expect(moving).toBeGreaterThanOrEqual(18);
    for (let n = 1; n < frames.length; n++) {
      if (frames[n].sy !== 1) expect(frames[n].sy).not.toBe(frames[n - 1].sy);
    }
    expect(eventSquash(anim, { squash, atMs: 1000 })).toEqual({ sx: 1, sy: 1 });
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
    const later = blobPose(anim, { player, squash, nowMs: 100 });
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
const FOOT_CENTRE = 0.2 * R;
/** One frame's input at `nowMs`, on a root that carries `rootLean` for the slope. */
const feetFrame = (p: PlayerState, nowMs: number, rootLean = 0) => ({
  player: p,
  feet,
  r: R,
  bodySx: 1,
  footCentre: FOOT_CENTRE,
  rootLean,
  nowMs,
});

function run(p: PlayerState, ms: number, motion = createFeetMotion(p)) {
  const start = motion.lastMs === null ? 0 : motion.lastMs + 16;
  let pose = stepFeetMotion(motion, feetFrame(p, start));
  for (let t = start + 16; t <= start + ms; t += 16) {
    pose = stepFeetMotion(motion, feetFrame(p, t));
  }
  return { pose, motion };
}

/** How far a foot at rest sits under the body circle's centre. */
const restDepth = (p: PlayerState): number => p.width / 2 - FOOT_CENTRE;

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
});

/**
 * The right foot as the screen shows it (root frame, turned by the root's lean), frame by frame:
 * 60 frames up an arc from flat to 80°, then 30 frames on the wall it meets.
 */
function sweepSlopeIntoWall() {
  const p = feetPlayer({ vx: 200 });
  const motion = createFeetMotion(p);
  const tilt = createGroundTilt();
  const tunables = DEFAULT_GAME_TUNABLES.feel.groundTilt;
  return Array.from({ length: 90 }, (_, frame) => {
    const onWall = frame >= 60;
    p.grounded = !onWall;
    p.wallDir = onWall ? 1 : 0;
    p.groundAngle = onWall ? 0 : ((80 * Math.PI) / 180) * (frame / 59);
    const nowMs = frame * 16;
    const { groundAngle, grounded } = p;
    const rootLean = stepGroundTilt(tilt, { groundAngle, grounded, nowMs, tunables });
    const foot = stepFeetMotion(motion, feetFrame(p, nowMs, rootLean))[1];
    return { rotation: foot.rotation + rootLean, x: foot.x, y: foot.y };
  });
}

describe("stepFeetMotion on slopes and walls", () => {
  it("should stand both feet side by side on the wall when touching a right wall", () => {
    const p = feetPlayer({ grounded: false, wallDir: 1, vy: 0 });
    const { pose } = run(p, 1000);
    for (const foot of pose) {
      // Soles to the wall, on the wall side of the body circle.
      expect(foot.rotation).toBeCloseTo(-Math.PI / 2);
      expect(foot.x).toBeCloseTo(restDepth(p), 1);
    }
    // The same spacing as on the floor, now along the wall; the right foot is the upper one.
    expect(pose[1].y - pose[0].y).toBeCloseTo(-2 * 0.45 * R, 1);
  });

  it("should lay the soles along the slope when standing on a hill the root leans into", () => {
    const slope = Math.PI / 4;
    const rootLean = -0.6 * slope;
    const p = feetPlayer({ groundAngle: slope });
    const motion = createFeetMotion(p);
    let pose = stepFeetMotion(motion, feetFrame(p, 0, rootLean));
    for (let t = 16; t <= 1000; t += 16) pose = stepFeetMotion(motion, feetFrame(p, t, rootLean));
    // Root lean plus the feet's own turn is the whole slope.
    expect(pose[0].rotation + rootLean).toBeCloseTo(-slope);
    expect(pose[1].rotation + rootLean).toBeCloseTo(-slope);
  });

  it("should turn the feet without a snap when a steepening slope becomes a wall", () => {
    const shown = sweepSlopeIntoWall();
    const steps = shown.slice(1).map((foot, i) => ({ foot, before: shown[i]! }));
    const turns = steps.map(({ foot, before }) => Math.abs(foot.rotation - before.rotation));
    const moves = steps.map(({ foot, before }) => Math.hypot(foot.x - before.x, foot.y - before.y));
    expect(Math.max(...turns)).toBeLessThan(0.12);
    expect(Math.max(...moves)).toBeLessThan(0.35 * R);
    expect(shown[shown.length - 1]?.rotation).toBeCloseTo(-Math.PI / 2, 1);
  });

  it("should keep stepping along the wall when moving up it", () => {
    const p = feetPlayer({ grounded: false, wallDir: 1, vy: -300 });
    const { motion } = run(p, 1000);
    const start = (motion.lastMs ?? 0) + 16;
    let nearest = Infinity;
    for (let frame = 0; frame < 30; frame++) {
      p.y -= 5;
      const pose = stepFeetMotion(motion, feetFrame(p, start + frame * 16));
      nearest = Math.min(nearest, pose[0].x, pose[1].x);
    }
    // A stepping foot lifts off the wall, toward the body.
    expect(nearest).toBeLessThan(restDepth(p) - 0.5 * feet.stepLift * R);
  });

  it("should let go of the wall and trail the flight after a wall-jump", () => {
    const p = feetPlayer({ grounded: false, wallDir: -1, lastWallDir: -1 });
    const { motion } = run(p, 1000);
    p.wallDir = 0;
    p.wallJumpCount += 1;
    p.vx = 300;
    const t0 = (motion.lastMs ?? 0) + 16;
    // One frame off the wall the soles still mostly face it; the turn eases from there.
    const first = stepFeetMotion(motion, feetFrame(p, t0));
    expect(first[0].rotation).toBeGreaterThan(0.8 * (Math.PI / 2));
    let pose = first;
    for (let t = t0 + 16; t <= t0 + 1000; t += 16) pose = stepFeetMotion(motion, feetFrame(p, t));
    expect(pose[0].rotation).toBeCloseTo(-(300 / feet.airTiltSpeed) * feet.airTilt, 1);
  });
});

describe("stepFeetMotion springs", () => {
  it("should not turn the feet when the render clock jumps back", () => {
    const { motion } = run(feetPlayer(), 200);
    const pose = stepFeetMotion(motion, feetFrame(feetPlayer(), 0));
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

  const crouchedAt = (nowMs: number) => {
    const player = standing();
    player.vx = 0;
    const anim = createBlobAnim(player);
    player.crouching = true;
    noteCrouch(anim.crouch, { player, crouch, nowMs: 0 });
    return blobPose(anim, { player, squash, nowMs, crouch });
  };

  it("should never scale the body or the helmet with it when crouched (crouch-sink D1)", () => {
    for (const ms of [0, 50, 100, 400, 900]) {
      const pose = crouchedAt(ms);
      expect(pose.bodySx).toBeCloseTo(1, 1);
      expect(pose.bodySy).toBeCloseTo(1, 1);
    }
  });

  it("should report the sunk helmet and the vanished feet when held", () => {
    const pose = crouchedAt(900);
    expect(pose.crouch.k).toBe(1);
    expect(pose.crouch.drop).toBe(crouch.drop);
    expect(pose.crouch.feetScale).toBe(0);
    expect(pose.crouch.helmetSink).toBeGreaterThan(crouch.helmetSink - crouch.breathe - 0.01);
  });

  it("should keep the standing pose when not crouching", () => {
    const player = standing();
    const anim = createBlobAnim(player);
    expect(blobPose(anim, { player, squash, nowMs: 500, crouch }).crouch).toEqual(STANDING_SINK);
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

// --- Contact hold ---

const HOLD_SECONDS = feet.contactHoldSeconds;

describe("stepContactHold", () => {
  it("should keep the ground contact when the sim flips it off and on every step", () => {
    const p = feetPlayer({ groundAngle: 1.4 });
    const hold = createContactHold(p);
    const seen: boolean[] = [];
    for (let i = 0; i < 60; i += 1) {
      p.grounded = i % 2 === 0;
      p.wallDir = p.grounded ? 0 : 1;
      p.groundAngle = p.grounded ? 1.4 : 0;
      const contact = stepContactHold(hold, { player: p, nowMs: i * 8, seconds: HOLD_SECONDS });
      seen.push(contact.grounded);
      expect(contact.groundAngle).toBe(1.4);
    }
    expect(seen.every(Boolean)).toBe(true);
  });

  it("should let go of the ground at once when a jump is counted", () => {
    const p = feetPlayer();
    const hold = createContactHold(p);
    stepContactHold(hold, { player: p, nowMs: 0, seconds: HOLD_SECONDS });
    p.grounded = false;
    p.jumpCount += 1;
    const contact = stepContactHold(hold, { player: p, nowMs: 8, seconds: HOLD_SECONDS });
    expect(contact.grounded).toBe(false);
  });

  it("should let go of the ground when it stays gone longer than the hold time", () => {
    const p = feetPlayer();
    const hold = createContactHold(p);
    stepContactHold(hold, { player: p, nowMs: 0, seconds: HOLD_SECONDS });
    p.grounded = false;
    const at = (ms: number) =>
      stepContactHold(hold, { player: p, nowMs: ms, seconds: HOLD_SECONDS }).grounded;
    expect(at(HOLD_SECONDS * 1000 - 10)).toBe(true);
    expect(at(HOLD_SECONDS * 1000 + 10)).toBe(false);
  });
});

// A floor that curves up through a quarter arc (radius 120, 4-unit samples) into a wall: every
// slope angle from 0° to 90°, across many cell edges.
const ARC_R = 120;
const arcWorld: LevelDefinition = {
  formatVersion: 1,
  meta: { levelId: "arc", title: "Arc" },
  settings: { cellSize: 4, gravity: 1 },
  worldSize: { w: 800, h: 400 },
  terrain: [
    {
      shape: {
        type: "polygon",
        points: [
          { x: 0, y: 320 },
          ...Array.from({ length: 25 }, (_, i) => {
            const a = (i / 24) * (Math.PI / 2);
            return { x: 500 + ARC_R * Math.sin(a), y: 320 - ARC_R * (1 - Math.cos(a)) };
          }),
          { x: 620, y: 0 },
          { x: 800, y: 0 },
          { x: 800, y: 400 },
          { x: 0, y: 400 },
        ],
      },
      materialId: "stone",
    },
  ],
  spawns: [],
  drops: [],
  collectibles: [],
  bounds: { x: 0, y: 0, w: 800, h: 400 },
};

/**
 * Runs the real controller up the arc and into the wall, holding right, and draws every
 * `stride`-th sim step (1 = 120 fps, 2 = 60 fps). Returns what the screen shows per drawn frame.
 */
function drawArcRun(stride: number) {
  const terrain = buildTerrainFromLevel(arcWorld);
  const p = createPlayer(0, { x: 300, y: 280 }, DEFAULT_GAME_TUNABLES);
  const draw = arcDrawer(p);
  const frames: ReturnType<typeof draw>[] = [];
  for (let i = 0; i < 600; i += 1) {
    const inputs = [{ ...EMPTY_PLAYER_INPUT, connected: true, moveX: i < 60 ? 0 : 1 }];
    stepPlayers({ players: [p], inputs, terrain, tunables: DEFAULT_GAME_TUNABLES, dt: 1 / 120 });
    if (i % stride === 0) frames.push(draw((i * 1000) / 120));
  }
  // From the first frame standing on the floor.
  return frames.slice(frames.findIndex((frame) => frame.rawGrounded));
}

/** One drawn frame the way the renderer chains it: contact hold, then lean, then feet and shadow. */
function arcDrawer(p: PlayerState) {
  const hold = createContactHold(p);
  const motion = createFeetMotion(p);
  const tilt = createGroundTilt();
  const tunables = DEFAULT_GAME_TUNABLES.feel.groundTilt;
  return (nowMs: number) => {
    const contact = stepContactHold(hold, { player: p, nowMs, seconds: HOLD_SECONDS });
    const { groundAngle, grounded } = contact;
    const lean = stepGroundTilt(tilt, { groundAngle, grounded, nowMs, tunables });
    stepFeetMotion(motion, { ...feetFrame(p, nowMs, lean), contact });
    return {
      // Where the soles face on screen, without the run cycle's own toe tilt.
      sole: motion.lastAngleTarget + motion.angle.value + lean,
      lean,
      shadow: blobShadow(p, contact) !== null,
      rawGrounded: p.grounded,
    };
  };
}

const flips = (values: boolean[]): number =>
  values.filter((value, i) => i > 0 && value !== values[i - 1]).length;

const maxStep = (values: number[]): number =>
  Math.max(...values.slice(1).map((value, i) => Math.abs(value - values[i]!)));

describe("feet, lean and shadow on a slope that steepens into a wall", () => {
  it("should keep the sim's ground contact steady when resting where the slope meets the wall", () => {
    // The flicker's old cause is fixed at the source (slope-jump D1); the hold below stays for
    // contacts that still flip, on moving parts.
    expect(flips(drawArcRun(1).map((frame) => frame.rawGrounded))).toBe(0);
  });

  it.each([1, 2])("should not flicker when drawn every %i sim steps", (stride) => {
    const frames = drawArcRun(stride);
    expect(frames.some((frame) => frame.shadow)).toBe(false);
    // Radians per drawn frame: a smooth turn, never a ping-pong.
    expect(maxStep(frames.map((frame) => frame.sole))).toBeLessThan(0.08 * stride);
    expect(maxStep(frames.map((frame) => frame.lean))).toBeLessThan(0.05 * stride);
    // Pushing into the wall at the end, everything stands still.
    const tail = frames.slice(-60 / stride);
    expect(maxStep(tail.map((frame) => frame.sole))).toBeLessThan(0.005);
    expect(maxStep(tail.map((frame) => frame.lean))).toBeLessThan(0.005);
  });
});

describe("barrelPopScale", () => {
  const pop = DEFAULT_GAME_TUNABLES.feel.barrelPop;

  it("should be the pop pose when the shot has just happened", () => {
    expect(barrelPopScale(0, pop)).toEqual({ sx: pop.sx, sy: pop.sy });
  });

  it("should rest at full size when no shot happened or the pop is over", () => {
    expect(barrelPopScale(Number.POSITIVE_INFINITY, pop)).toEqual({ sx: 1, sy: 1 });
    expect(barrelPopScale(pop.seconds * 1000, pop)).toEqual({ sx: 1, sy: 1 });
    expect(barrelPopScale(-5, pop)).toEqual({ sx: 1, sy: 1 });
  });

  it("should spring past rest before settling when recovering", () => {
    const late = barrelPopScale(pop.seconds * 1000 * 0.6, pop);
    expect(late.sx).toBeGreaterThan(1);
    expect(late.sy).toBeLessThan(1);
  });

  it("should stay inside the juice squash band when sampled through the whole pop", () => {
    for (let ms = 0; ms <= pop.seconds * 1000; ms += 10) {
      expect(isJuiceSquash(barrelPopScale(ms, pop))).toBe(true);
    }
  });
});
