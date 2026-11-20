import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import { isInJuiceWindow, isJuiceSquash } from "@/shared/config/gameJuice";
import { createDiveState, resetDive } from "@/features/dive/services/diveSim";
import { DENIED_SHAKE_SECONDS, deniedShake, diveBlobPose } from "@/features/dive/services/divePose";
import { createPlayer } from "@/features/player/api/playerApi";

const motionWith = (sinceDenied: number) => {
  const dive = createDiveState();
  const player = createPlayer(0, { x: 0, y: 0 }, DEFAULT_GAME_TUNABLES);
  resetDive(dive, player);
  const motion = dive.motions[player.id]!;
  motion.sinceDenied = sinceDenied;
  return motion;
};

describe("denied dash head shake", () => {
  it("should last inside the squash window when a press is denied", () => {
    expect(isInJuiceWindow("squash", DENIED_SHAKE_SECONDS)).toBe(true);
  });

  it("should shake the head without squashing the body when a press was just denied", () => {
    const pose = diveBlobPose(motionWith(DENIED_SHAKE_SECONDS / 8), DEFAULT_GAME_TUNABLES.dive);
    expect(pose).not.toBeNull();
    expect(Math.abs(pose!.rotation)).toBeGreaterThan(0.05);
    expect(isJuiceSquash(pose!)).toBe(true);
  });

  it("should leave the plain pose when the shake is over", () => {
    expect(deniedShake(DENIED_SHAKE_SECONDS)).toBe(0);
    expect(diveBlobPose(motionWith(Infinity), DEFAULT_GAME_TUNABLES.dive)).toBeNull();
  });
});
