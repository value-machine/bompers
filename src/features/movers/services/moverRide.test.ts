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
import { MOTION_LIMITS } from "@/shared/utils/levelMotion";
import {
  inheritOnLeave,
  leaveVelocity,
  rideMovers,
  stepMoverPoses,
  type MovingRider,
  type RideResult,
  type RiderBody,
} from "@/features/movers/services/moverRide";

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
/** The game default: a gap under 20% of the body width crushes. */
const OPTS = { crushGapFraction: 0.2 };

/** Steps poses and riders from t = 0 to `until` seconds. */
function run(terrain: ReturnType<typeof arenaWith>, bodies: RiderBody[], until: number) {
  const pinned = new Set<number>();
  for (let t = DT; t <= until + 1e-9; t += DT) {
    stepMoverPoses(terrain, t);
    for (const pin of rideMovers(terrain, bodies, OPTS).pinned) pinned.add(pin.index);
  }
  return pinned;
}

/** Steps from `from` to `to` seconds: the tightest squeeze seen, any crush, and the last result. */
function squeezeRun(
  terrain: ReturnType<typeof arenaWith>,
  body: RiderBody,
  span: { from: number; to: number }
) {
  let tightest = 1;
  let crushed = false;
  let last: ReturnType<typeof rideMovers> | null = null;
  for (let t = span.from + DT; t <= span.to + 1e-9; t += DT) {
    stepMoverPoses(terrain, t);
    last = rideMovers(terrain, [body], OPTS);
    crushed ||= last.pinned.length > 0;
    tightest = Math.min(tightest, last.squeezed[0]?.scale ?? 1);
  }
  return { tightest, crushed, last };
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
    let first: ReturnType<typeof rideMovers>["pinned"][number] | undefined;
    for (let t = DT; t <= 2 + 1e-9 && !first; t += DT) {
      stepMoverPoses(terrain, t);
      first = rideMovers(terrain, [body], OPTS).pinned[0];
    }
    // The squeeze points from the part toward the wall (+x) and names the part.
    expect(first?.index).toBe(0);
    expect(first?.mover).toBe(0);
    expect(first?.nx).toBeGreaterThan(0.9);
  });

  // Ground truth: the owner's change round on #64 — a gap narrower than the blob but not near-closed
  // is survivable: it squashes to fit and recovers when the gap opens.
  it("should squeeze but not crush a body when the gap closes to 80% of its width, then free it", () => {
    const slider = stone({ type: "rect", x: 300, y: 500, w: 80, h: 60 });
    const mover: LevelMover = {
      // Ends 22 units from the wall: 22 / 28 ≈ 0.79 of the body width.
      motion: { kind: "slide", offset: { x: 198, y: 0 }, periodS: 4, phase: 0 },
      pivot: { x: 340, y: 530 },
      terrainIndices: [2],
    };
    const terrain = arenaWith([GROUND, WALL, slider], [mover]);
    const body: RiderBody = { x: 560, y: 560, width: 28, height: 28 };
    const closing = squeezeRun(terrain, body, { from: 0, to: 2 });
    expect(closing.crushed).toBe(false);
    // Gap 22 minus a 1-unit margin each side, over the 28 width: (22 − 2) / 28 ≈ 0.71.
    expect(closing.tightest).toBeGreaterThan(0.68);
    expect(closing.tightest).toBeLessThan(0.75);
    // The slider pulls back: the body is free again.
    const opening = squeezeRun(terrain, body, { from: 2, to: 4 });
    expect(opening.last?.squeezed[0]).toBeNull();
    expect(opening.last?.pinned).toEqual([]);
  });

  it("should leave bodies alone when the level has no moving parts", () => {
    const terrain = arenaWith([GROUND], []);
    const body: RiderBody = { x: 280, y: 560, width: 28, height: 28 };
    expect(rideMovers(terrain, [body], OPTS)).toEqual({
      pinned: [],
      squeezed: [null],
      carried: [null],
    });
    expect(body).toEqual({ x: 280, y: 560, width: 28, height: 28 });
  });
});

describe("inheritOnLeave", () => {
  const ride = (carried: RideResult["carried"]): RideResult => ({
    pinned: [],
    squeezed: carried.map(() => null),
    carried,
  });
  const rider = (): MovingRider => ({ id: "p0", x: 0, y: 0, width: 28, height: 28, vx: 10, vy: 0 });

  it("should remember the carry velocity while the body rides", () => {
    const body = rider();
    const memory = inheritOnLeave(new Map(), [body], { ride: ride([{ x: 0, y: -2 }]), dt: 0.5 });
    expect(memory.get("p0")).toEqual({ x: 0, y: -4 });
    expect(body.vx).toBe(10);
  });

  it("should add the part's velocity once when the body stops riding", () => {
    const body = rider();
    const memory = new Map([["p0", { x: 30, y: -120 }]]);
    const next = inheritOnLeave(memory, [body], { ride: ride([null]), dt: 1 / 60 });
    expect(body.vx).toBe(40);
    expect(body.vy).toBe(-120);
    expect(next.size).toBe(0);
  });

  it("should cap the kept velocity at the ride speed when a fast part flings the body", () => {
    const kept = leaveVelocity({ x: 0, y: -2 * MOTION_LIMITS.rideSpeed });
    expect(kept.x).toBeCloseTo(0);
    expect(kept.y).toBeCloseTo(-MOTION_LIMITS.rideSpeed);
  });

  it("should launch a player higher off a rising lift than its own jump would", () => {
    const terrain = arenaWith([GROUND, LIFT], [LIFT_MOVER]);
    const body: MovingRider = { id: "p0", x: 280, y: 400, width: 28, height: 28, vx: 0, vy: 0 };
    let memory: ReturnType<typeof inheritOnLeave> = new Map();
    for (let t = DT; t <= 1 + 1e-9; t += DT) {
      stepMoverPoses(terrain, t);
      memory = inheritOnLeave(memory, [body], { ride: rideMovers(terrain, [body], OPTS), dt: DT });
    }
    body.y -= 20; // the jump lifts the feet off the part
    stepMoverPoses(terrain, 1 + DT);
    inheritOnLeave(memory, [body], { ride: rideMovers(terrain, [body], OPTS), dt: DT });
    // Mid-rise the lift moves up at π·160/4 ≈ 126 units/s (slide: s = (1 − cos 2πu) / 2).
    expect(body.vy).toBeCloseTo(-40 * Math.PI, 0);
  });
});
