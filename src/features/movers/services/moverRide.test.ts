import { describe, expect, it } from "vitest";
import {
  createArenaState,
  fieldDistanceAt,
  isSolidAt,
  rectHitsSolid,
} from "@/features/arena/api/arenaApi";
import {
  normalizeLevelDefinition,
  type LevelDefinition,
  type LevelMover,
  type TerrainPiece,
} from "@/features/level/api/levelApi";
import { rideMovers, stepMoverPoses, type RiderBody } from "@/features/movers/services/moverRide";

// Ground truth: LEVEL_FORMAT § 11 runtime contract (moving-parts D7, D11, D12) and motionPose.
const stone = (shape: TerrainPiece["shape"]): TerrainPiece => ({ shape, materialId: "stone" });
const GROUND = stone({ type: "rect", x: 0, y: 560, w: 800, h: 40 });
const WALL = stone({ type: "rect", x: 600, y: 300, w: 40, h: 260 });

function arenaWith(pieces: TerrainPiece[], movers: LevelMover[]) {
  const level: LevelDefinition = {
    formatVersion: 2,
    meta: { levelId: "t", title: "T" },
    settings: { cellSize: 4, gravity: 1 },
    worldSize: { w: 800, h: 600 },
    terrain: pieces,
    spawns: [
      { x: 40, y: 560 },
      { x: 80, y: 560 },
    ],
    drops: [{ at: { x: 400, y: 40 }, itemIds: ["rocket-launcher"] }],
    collectibles: [],
    movers,
    bounds: { x: 0, y: 0, w: 800, h: 600 },
  };
  return createArenaState(normalizeLevelDefinition(level).level).terrain;
}

/** A lift 160 wide at y 400–432 that slides up 160 and back every 4 s. */
const LIFT = stone({ type: "rect", x: 200, y: 400, w: 160, h: 32 });
const LIFT_MOVER: LevelMover = {
  motion: { kind: "slide", offset: { x: 0, y: -160 }, periodS: 4, phase: 0 },
  pivot: { x: 280, y: 416 },
  terrainIndices: [1],
};

const DT = 1 / 60;

/** Steps poses and riders from t = 0 to `until` seconds. */
function run(terrain: ReturnType<typeof arenaWith>, bodies: RiderBody[], until: number) {
  const pinned = new Set<number>();
  for (let t = DT; t <= until + 1e-9; t += DT) {
    stepMoverPoses(terrain, t);
    for (const i of rideMovers(terrain, bodies)) pinned.add(i);
  }
  return pinned;
}

describe("moving parts — collision", () => {
  it("should keep the part out of the static samples and move its solid with the pose", () => {
    const terrain = arenaWith([GROUND, LIFT], [LIFT_MOVER]);
    expect(terrain.movers).toHaveLength(1);
    expect(isSolidAt(terrain, 280, 416)).toBe(true);
    stepMoverPoses(terrain, 2);
    expect(isSolidAt(terrain, 280, 416)).toBe(false);
    expect(isSolidAt(terrain, 280, 256)).toBe(true);
    expect(rectHitsSolid(terrain, { x: 260, y: 250, w: 20, h: 10 })).toBe(true);
    expect(fieldDistanceAt(terrain, { x: 280, y: 256 })).toBeGreaterThan(0);
  });
});

describe("rideMovers", () => {
  it("should carry a body standing on a lift up with it when the lift rises", () => {
    const terrain = arenaWith([GROUND, LIFT], [LIFT_MOVER]);
    const body: RiderBody = { x: 280, y: 400, width: 28, height: 28 };
    run(terrain, [body], 2);
    expect(body.x).toBeCloseTo(280, 0);
    expect(body.y).toBeCloseTo(240, 0);
  });

  it("should push a body aside when a sliding part runs into it", () => {
    const slider = stone({ type: "rect", x: 100, y: 500, w: 80, h: 60 });
    const mover: LevelMover = {
      motion: { kind: "slide", offset: { x: 200, y: 0 }, periodS: 4, phase: 0 },
      pivot: { x: 140, y: 530 },
      terrainIndices: [1],
    };
    const terrain = arenaWith([GROUND, slider], [mover]);
    const body: RiderBody = { x: 220, y: 560, width: 28, height: 28 };
    const pinned = run(terrain, [body], 2);
    expect(body.x).toBeGreaterThan(380 + 13);
    expect(pinned.size).toBe(0);
  });

  it("should report a body squeezed between a part and a wall as pinned", () => {
    const slider = stone({ type: "rect", x: 300, y: 500, w: 80, h: 60 });
    const mover: LevelMover = {
      motion: { kind: "slide", offset: { x: 220, y: 0 }, periodS: 4, phase: 0 },
      pivot: { x: 340, y: 530 },
      terrainIndices: [2],
    };
    const terrain = arenaWith([GROUND, WALL, slider], [mover]);
    const body: RiderBody = { x: 560, y: 560, width: 28, height: 28 };
    expect(run(terrain, [body], 2)).toEqual(new Set([0]));
  });

  it("should leave bodies alone when the level has no moving parts", () => {
    const terrain = arenaWith([GROUND], []);
    const body: RiderBody = { x: 280, y: 560, width: 28, height: 28 };
    expect(rideMovers(terrain, [body])).toEqual([]);
    expect(body).toEqual({ x: 280, y: 560, width: 28, height: 28 });
  });
});
