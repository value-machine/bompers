import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import { mapPlayerInputs } from "@/shared/utils/gameInputMapping";
import type { LevelDefinition, LevelMover, TerrainPiece } from "@/features/level/api/levelApi";
import { readSoundCues, type SoundCursor } from "@/features/sound/api/soundApi";
import { createGameState, stepGame, type GameState } from "@/features/match/services/gameSim";
import { bonkedMaterialSound, soundSnapshotOf } from "@/features/match/services/matchSound";

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

describe("bonkedMaterialSound", () => {
  const walled: LevelDefinition = {
    ...level,
    terrain: [
      ...level.terrain,
      { shape: { type: "rect", x: 200, y: 200, w: 32, h: 120 }, materialId: "earth" },
    ],
  };

  it("should return the wall material's sound when the blob is pressed against it in the dive direction", () => {
    const state = createGameState({ level: walled, tunables: DEFAULT_GAME_TUNABLES });
    stepGame(state, keys(), dt);
    const [player] = state.players;
    if (!player) throw new Error("no player");
    player.x = 200 - player.width / 2;
    player.y = 320;
    expect(bonkedMaterialSound(state.arena.terrain, player, { x: 1, y: 0.2 })).toBe("crumble");
    expect(bonkedMaterialSound(state.arena.terrain, player, { x: 0.1, y: 1 })).toBe("thud");
  });

  it("should return none when no terrain is next to the blob in the dive direction", () => {
    const state = createGameState({ level: walled, tunables: DEFAULT_GAME_TUNABLES });
    stepGame(state, keys(), dt);
    const [player] = state.players;
    if (!player) throw new Error("no player");
    player.x = 100;
    player.y = 200;
    expect(bonkedMaterialSound(state.arena.terrain, player, { x: -1, y: -0.2 })).toBe("none");
  });
});

// Collision-sound jitter (owner, 2026-11-18): spots where the ground contact flips off and on, or
// a moving part keeps knocking the blob, replayed its landing sound in bursts. Before the fix the
// real sim counted 51 landings a second at the lip below, 2.6 on the spinning plank and 8 chasing
// the moving block; every one of them cued a `land`.
const stone = (shape: TerrainPiece["shape"]): TerrainPiece => ({ shape, materialId: "stone" });
const FLOOR = stone({ type: "rect", x: 0, y: 560, w: 800, h: 40 });
/** A floor that curves up through a quarter arc into a wall: every slope from 0° to 90°. */
const ARC = stone({
  type: "polygon",
  points: [
    { x: 0, y: 520 },
    ...Array.from({ length: 25 }, (_, i) => {
      const a = (i / 24) * (Math.PI / 2);
      return { x: 500 + 120 * Math.sin(a), y: 520 - 120 * (1 - Math.cos(a)) };
    }),
    { x: 620, y: 200 },
    { x: 800, y: 200 },
    { x: 800, y: 600 },
    { x: 0, y: 600 },
  ],
});
const PLANK = stone({ type: "rect", x: 200, y: 440, w: 240, h: 16 });
const BLOCK = stone({ type: "rect", x: 100, y: 480, w: 40, h: 80 });

function moverLevel(
  terrain: TerrainPiece[],
  movers: LevelMover[],
  spawn: { x: number; y: number }
) {
  const moving: LevelDefinition = {
    ...level,
    formatVersion: 2,
    settings: { cellSize: 4, gravity: 1 },
    worldSize: { w: 800, h: 600 },
    terrain,
    movers,
    spawns: [spawn, { x: 760, y: 100 }],
    bounds: { x: -100, y: -100, w: 1000, h: 800 },
  };
  return createGameState({ level: moving, tunables: DEFAULT_GAME_TUNABLES });
}

/** Settles for a second, then holds `codes` for `seconds`: the land cues player 0 got. */
function landCuesWhile(state: GameState, seconds: number, codes: string[]): number {
  let cursor: SoundCursor | null = null;
  for (let t = 0; t < 1; t += dt) {
    stepGame(state, keys(), dt);
    cursor = readSoundCues(cursor, soundSnapshotOf(state)).cursor;
  }
  let lands = 0;
  for (let t = 0; t < seconds; t += dt) {
    stepGame(state, keys(...codes), dt);
    const heard = readSoundCues(cursor, soundSnapshotOf(state));
    cursor = heard.cursor;
    lands += heard.cues.filter((cue) => cue.soundId === "land" && cue.slot === 0).length;
  }
  return lands;
}

describe("matchSound — collision sound jitter", () => {
  it("should play no land sound when the player keeps pushing into a slope that steepens into a wall", () => {
    expect(landCuesWhile(moverLevel([ARC], [], { x: 450, y: 500 }), 8, ["KeyD"])).toBe(0);
  });

  it("should play no land sound when the player stands on a spinning plank", () => {
    const spin: LevelMover = {
      motion: { kind: "spin", periodS: 12, direction: 1, phase: 0 },
      pivot: { x: 320, y: 448 },
      terrainIndices: [1],
    };
    // 2 s on it (a 60° turn): later the plank tips the blob off, a real fall and landing.
    expect(landCuesWhile(moverLevel([FLOOR, PLANK], [spin], { x: 300, y: 430 }), 2, [])).toBe(0);
  });

  it("should play at most one land sound per cycle when the player runs after a moving block", () => {
    const slide: LevelMover = {
      motion: { kind: "slide", offset: { x: 300, y: 0 }, periodS: 4, phase: 0 },
      pivot: { x: 120, y: 520 },
      terrainIndices: [1],
    };
    const state = moverLevel([FLOOR, BLOCK], [slide], { x: 300, y: 550 });
    expect(landCuesWhile(state, 8, ["KeyA"])).toBeLessThanOrEqual(2);
  });
});
