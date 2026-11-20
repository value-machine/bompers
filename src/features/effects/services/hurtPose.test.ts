import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import { hurtBlobPoses, hurtPoseAt } from "@/features/effects/services/hurtPose";
import type { PlayerHitFeel } from "@/features/effects/services/feelCues";

const HURT = DEFAULT_GAME_TUNABLES.feel.hurt;

const hitAt = (startMs: number, damage = 1): PlayerHitFeel => ({
  startMs,
  dirX: 1,
  hard: false,
  flash: 0,
  damage,
});

describe("hurtPoseAt", () => {
  it("should strike the full hurt squash with the eyes shut when the hurt lands", () => {
    expect(hurtPoseAt(0, HURT)).toEqual({ sx: HURT.squash.sx, sy: HURT.squash.sy, eyesShut: true });
  });

  it("should be at rest with the eyes open when the eyes-shut time is over", () => {
    expect(hurtPoseAt(HURT.eyesShutSeconds * 1000, HURT)).toBeNull();
  });

  it("should keep the eyes shut after the squash has sprung back when still inside the eyes-shut time", () => {
    const pose = hurtPoseAt(HURT.squash.seconds * 1000 + 1, HURT);
    expect(pose).toEqual({ sx: 1, sy: 1, eyesShut: true });
  });
});

describe("hurtBlobPoses", () => {
  it("should pose only the players hurt recently when hits are read", () => {
    const hits = new Map([
      ["fresh", hitAt(1000)],
      ["old", hitAt(0)],
      ["blocked", hitAt(1000, 0)],
    ]);
    const poses = hurtBlobPoses(hits, { nowMs: 1000, hurt: HURT });
    expect([...poses.keys()]).toEqual(["fresh"]);
  });
});
