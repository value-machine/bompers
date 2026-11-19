import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import type { LevelCollectible } from "@/features/level/api/levelApi";
import { createPlayer } from "@/features/player/api/playerApi";
import {
  createCollectiblesState,
  stepCollectibles,
} from "@/features/collectibles/services/collectiblesSim";

const tunables = DEFAULT_GAME_TUNABLES;
const schedule = tunables.collectibles;
const dt = 1 / 120;
const points: LevelCollectible[] = [
  { at: { x: 100, y: 200 }, itemId: "point-orb" },
  { at: { x: 300, y: 200 }, itemId: "point-orb" },
  { at: { x: 500, y: 200 }, itemId: "point-orb" },
];

/** Runs `seconds` of steps with the given players; returns every orb collected. */
function run(
  state: ReturnType<typeof createCollectiblesState>,
  seconds: number,
  players: ReturnType<typeof createPlayer>[] = []
) {
  const collected = [];
  for (let t = 0; t < seconds; t += dt) {
    collected.push(...stepCollectibles({ collectibles: state, points, players, tunables, dt }));
  }
  return collected;
}

describe("collectiblesSim", () => {
  it("should spawn the first orb above the first point when the first delay passes", () => {
    const state = createCollectiblesState(tunables);
    run(state, schedule.firstDelaySeconds - 0.05);
    expect(state.orbs).toHaveLength(0);
    run(state, 0.1);
    expect(state.orbs).toHaveLength(1);
    expect(state.orbs[0]).toMatchObject({ pointIndex: 0, x: 100 });
    expect(state.orbs[0]!.y).toBeLessThan(200);
  });

  it("should keep an orb on its authored point when it has landed", () => {
    const state = createCollectiblesState(tunables);
    run(state, schedule.firstDelaySeconds + 2);
    expect(state.orbs[0]).toMatchObject({ y: 200, vy: 0 });
  });

  it("should use the points round-robin and stop at the max active count when nobody collects", () => {
    const state = createCollectiblesState(tunables);
    run(state, schedule.firstDelaySeconds + schedule.intervalSeconds * 4);
    expect(state.orbs.map((orb) => orb.pointIndex)).toEqual([0, 1]);
    expect(state.orbs).toHaveLength(schedule.maxActive);
  });

  it("should give the orb to the player touching it and remove it when a player stands on the point", () => {
    const state = createCollectiblesState(tunables);
    const player = createPlayer(2, { x: 100, y: 210 }, tunables);
    const collected = run(state, schedule.firstDelaySeconds + 2, [player]);
    expect(collected).toEqual([expect.objectContaining({ slot: 2 })]);
    expect(state.orbs).toHaveLength(0);
    expect(state.orbCounts[2]).toBe(1);
  });

  it("should burst where the orb was taken and drop the burst when its time has passed", () => {
    const state = createCollectiblesState(tunables);
    const player = createPlayer(0, { x: 100, y: 210 }, tunables);
    let collected = 0;
    while (collected === 0) collected = run(state, dt / 2, [player]).length;
    expect(state.bursts).toEqual([expect.objectContaining({ itemId: "point-orb", x: 100 })]);
    run(state, 0.5);
    expect(state.bursts).toHaveLength(0);
  });

  it("should count how long a landed orb has rested when it hovers on its point", () => {
    const state = createCollectiblesState(tunables);
    run(state, schedule.firstDelaySeconds + 2);
    const [orb] = state.orbs;
    expect(orb!.restSeconds).toBeGreaterThan(0);
    expect(orb!.ageSeconds).toBeGreaterThan(orb!.restSeconds);
  });

  it("should spawn nothing when the level has no point-orb collectibles", () => {
    const state = createCollectiblesState(tunables);
    for (let t = 0; t < 20; t += dt) {
      stepCollectibles({
        collectibles: state,
        points: [{ at: { x: 1, y: 1 }, itemId: "other" }],
        players: [],
        tunables,
        dt,
      });
    }
    expect(state.orbs).toHaveLength(0);
  });
});
