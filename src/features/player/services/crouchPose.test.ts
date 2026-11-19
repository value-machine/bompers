import { describe, expect, it } from "vitest";
import { isInJuiceWindow, JUICE_SQUASH } from "@/shared/config/gameJuice";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import { blobMetrics, helmetDome, helmetGlint } from "@/features/player/services/blobShapes";
import {
  createCrouchClock,
  crouchEyeY,
  crouchGloss,
  crouchHelmetDrop,
  crouchOutline,
  crouchSink,
  domeHalfWidth,
  noteCrouch,
  outlineArea,
  standingGloss,
  STANDING_SINK,
  type CrouchClock,
} from "@/features/player/services/crouchPose";
import { createPlayer } from "@/features/player/services/playerController";
import type { PlayerState } from "@/features/player/types/player.types";

const crouch = DEFAULT_GAME_TUNABLES.player.crouch;
const m = blobMetrics(DEFAULT_GAME_TUNABLES.player.height);

const standingPlayer = (): PlayerState => createPlayer(0, { x: 0, y: 100 }, DEFAULT_GAME_TUNABLES);

/** A clock pressed at 0 ms and, when given, released at `releaseMs`. */
function crouchClock(releaseMs?: number): CrouchClock {
  const player = standingPlayer();
  const clock = createCrouchClock(player);
  player.crouching = true;
  noteCrouch(clock, { player, crouch, nowMs: 0 });
  if (releaseMs !== undefined) {
    player.crouching = false;
    noteCrouch(clock, { player, crouch, nowMs: releaseMs });
  }
  return clock;
}

/** Outline points at or above the helmet's rim line that lie outside the dome. */
function spilledPoints(clock: CrouchClock, nowMs: number): number {
  const sink = crouchSink(clock, crouch, nowMs);
  const outline = crouchOutline(m, { sink, crouch });
  if (!outline) return 0;
  const helmetY = crouchHelmetDrop(m, sink);
  return outline.filter(([x, y]) => {
    const width = domeHalfWidth(m, y, helmetY);
    return width !== null && Math.abs(x) > width + 0.3 * m.u + 1e-9;
  }).length;
}

const standingArea = (): number => {
  // A barely-started crouch is the plain egg (no top scale, no bulge, no drop).
  const sink = { ...STANDING_SINK, k: 1e-9 };
  return outlineArea(crouchOutline(m, { sink, crouch })!);
};

describe("crouch pose (crouch-sink acceptance)", () => {
  it("should keep the body inside the helmet on every frame of a crouch when sinking, holding and standing up", () => {
    const pressed = crouchClock();
    for (let ms = 0; ms <= 1500; ms += 4) expect(spilledPoints(pressed, ms)).toBe(0);
    for (const releaseAt of [40, 120, 800]) {
      const released = crouchClock(releaseAt);
      for (let ms = releaseAt; ms <= releaseAt + 300; ms += 4) {
        expect(spilledPoints(released, ms)).toBe(0);
      }
    }
  });

  it("should keep the held body's area inside the squash band when fully sunk", () => {
    const clock = crouchClock();
    for (const ms of [500, 900, 1300]) {
      const sink = crouchSink(clock, crouch, ms);
      // Area before the ground press: what the jelly holds (the press only spreads it).
      const unpressed = crouchOutline(m, { sink: { ...sink, drop: 0 }, crouch })!;
      const ratio = outlineArea(unpressed) / standingArea();
      expect(ratio).toBeGreaterThanOrEqual(JUICE_SQUASH.minArea);
      expect(ratio).toBeLessThanOrEqual(JUICE_SQUASH.maxArea);
    }
  });

  it("should press the held body onto the ground and spread it wider than standing when sunk", () => {
    const sink = crouchSink(crouchClock(), crouch, 900);
    const outline = crouchOutline(m, { sink, crouch })!;
    const bottom = Math.max(...outline.map(([, y]) => y));
    const onGround = outline.filter(([, y]) => y >= m.bodyLift - 1e-9);
    expect(bottom).toBeCloseTo(m.bodyLift, 6);
    expect(Math.max(...onGround.map(([x]) => Math.abs(x)))).toBeGreaterThan(0.6 * m.r);
    expect(crouchHelmetDrop(m, sink)).toBeCloseTo((crouch.helmetSink + crouch.drop) * m.u, 0);
  });

  it("should make the feet vanish within 60 ms when crouching starts", () => {
    const clock = crouchClock();
    expect(crouchSink(clock, crouch, 0).feetScale).toBe(1);
    expect(crouchSink(clock, crouch, 60).feetScale).toBe(0);
    expect(crouchSink(clock, crouch, 900).feetScale).toBe(0);
  });

  it("should settle and then breathe around the hold when held", () => {
    const clock = crouchClock();
    const peak = Math.max(
      ...Array.from({ length: 40 }, (_, i) => crouchSink(clock, crouch, i * 5).helmetSink)
    );
    expect(peak).toBeGreaterThan(crouch.helmetSink + 0.5 * crouch.overshoot);
    for (let ms = 800; ms <= 3000; ms += 50) {
      const { helmetSink } = crouchSink(clock, crouch, ms);
      expect(Math.abs(helmetSink - crouch.helmetSink)).toBeLessThanOrEqual(crouch.breathe + 0.05);
    }
  });

  it("should stand up with a helmet hop and end on the standing pose when released", () => {
    const clock = crouchClock(900);
    const lowest = Math.min(
      ...Array.from({ length: 50 }, (_, i) => crouchSink(clock, crouch, 900 + i * 4).helmetSink)
    );
    expect(lowest).toBeLessThan(-0.5 * crouch.hop);
    expect(crouchSink(clock, crouch, 900 + 250)).toEqual(STANDING_SINK);
    expect(crouchOutline(m, { sink: STANDING_SINK, crouch })).toBeNull();
  });

  it("should ease from the current pose when crouch is pressed again during the stand-up", () => {
    const player = standingPlayer();
    const clock = createCrouchClock(player);
    player.crouching = true;
    noteCrouch(clock, { player, crouch, nowMs: 0 });
    player.crouching = false;
    noteCrouch(clock, { player, crouch, nowMs: 600 });
    const before = crouchSink(clock, crouch, 650);
    player.crouching = true;
    noteCrouch(clock, { player, crouch, nowMs: 650 });
    const after = crouchSink(clock, crouch, 654);
    expect(Math.abs(after.k - before.k)).toBeLessThan(0.05);
    expect(Math.abs(after.drop - before.drop)).toBeLessThan(1);
  });

  it("should time the sink, the stand-up, the hop and the settle inside the juice windows", () => {
    expect(isInJuiceWindow("squash", crouch.sinkSeconds)).toBe(true);
    expect(isInJuiceWindow("squash", crouch.riseSeconds)).toBe(true);
    expect(isInJuiceWindow("squash", crouch.hopSeconds)).toBe(true);
    expect(isInJuiceWindow("settle", crouch.settleSeconds)).toBe(true);
  });

  it("should lower the hurt box about as far as the helmet sinks when the crouch tunables are set", () => {
    // Body top sits 9 u + 2 r = 69 u above the feet (blobMetrics).
    expect(crouch.hurtHeightScale).toBeCloseTo(1 - (crouch.helmetSink + crouch.drop) / 69, 1);
  });

  it("should tuck the eyes under the rim and slide the gloss onto the left arc when sunk", () => {
    const sink = crouchSink(crouchClock(), crouch, 900);
    const outline = crouchOutline(m, { sink, crouch });
    const rimY = helmetDome(m)[0][1] + crouchHelmetDrop(m, sink);
    expect(crouchEyeY(m, sink)).toBeCloseTo(rimY + 3 * m.u, 6);
    expect(crouchEyeY(m, STANDING_SINK)).toBeCloseTo(0.12 * m.r, 6);
    const gloss = crouchGloss(m, { sink, outline });
    expect(gloss.x).toBeLessThan(standingGloss(m).x);
    expect(gloss.y).toBeGreaterThan(rimY);
    expect(crouchGloss(m, { sink: STANDING_SINK, outline: null })).toEqual(standingGloss(m));
  });
});

describe("helmet glint", () => {
  it("should keep the whole glint stroke at least 2 u inside the dome when drawn", () => {
    const { start, control, end, width } = helmetGlint(m);
    const reach = width / 2 + 2 * m.u;
    for (let i = 0; i <= 40; i += 1) {
      const t = i / 40;
      const x = (1 - t) ** 2 * start[0] + 2 * t * (1 - t) * control[0] + t * t * end[0];
      const y = (1 - t) ** 2 * start[1] + 2 * t * (1 - t) * control[1] + t * t * end[1];
      for (const dy of [-reach, 0, reach]) {
        const halfWidth = domeHalfWidth(m, y + dy, 0) ?? Infinity;
        expect(Math.abs(x) + (dy === 0 ? reach : 0)).toBeLessThanOrEqual(halfWidth);
      }
    }
  });
});
