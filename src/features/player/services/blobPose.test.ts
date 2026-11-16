import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import {
  blobPose,
  blobShadow,
  createBlobAnim,
  createHelmetWobble,
  eventSquash,
  kickHelmetForHit,
  kickHelmetForSquash,
  noteBlobEvents,
  stepHelmetWobble,
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
    kickHelmetForSquash(wobble, { kind: "land", amount: 1, vx: 0, tumbling: false }, helmet);
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
