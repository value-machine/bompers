import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import { mapPlayerInputs } from "@/shared/utils/gameInputMapping";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import { readSoundCues } from "@/features/sound/api/soundApi";
import { createGameState, stepGame } from "@/features/match/services/gameSim";
import { soundSnapshotOf } from "@/features/match/services/matchSound";

const level: LevelDefinition = {
  formatVersion: 1,
  meta: { levelId: "t", title: "T" },
  settings: { cellSize: 8, gravity: 1 },
  worldSize: { w: 800, h: 400 },
  terrain: [{ shape: { type: "rect", x: 0, y: 320, w: 800, h: 32 }, materialId: "stone" }],
  spawns: [
    { x: 100, y: 200 },
    { x: 600, y: 200 },
  ],
  drops: [],
  collectibles: [],
  bounds: { x: -100, y: -100, w: 1000, h: 600 },
};

const dt = 1 / 120;
const keys = (...codes: string[]) => mapPlayerInputs({ heldKeys: new Set(codes), gamepads: [] });

describe("matchSound", () => {
  it("should cue a land then a pitched jump when a spawned player falls and jumps", () => {
    const state = createGameState({ level, tunables: DEFAULT_GAME_TUNABLES });
    stepGame(state, keys(), dt);
    let { cursor, cues } = readSoundCues(null, soundSnapshotOf(state));
    expect(cues.map((cue) => cue.soundId)).toEqual(["round-start"]);

    const heard: string[] = [];
    for (let t = 0; t < 1.5; t += dt) {
      stepGame(state, keys(), dt);
      ({ cursor, cues } = readSoundCues(cursor, soundSnapshotOf(state)));
      heard.push(...cues.map((cue) => `${cue.soundId}:${cue.slot}`));
    }
    expect(heard).toContain("land:0");

    for (let t = 0; t < 0.1; t += dt) {
      stepGame(state, keys("Space"), dt);
      ({ cursor, cues } = readSoundCues(cursor, soundSnapshotOf(state)));
      heard.push(...cues.map((cue) => `${cue.soundId}:${cue.slot}`));
    }
    expect(heard).toContain("jump:0");
  });
});
