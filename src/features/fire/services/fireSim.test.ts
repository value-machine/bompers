import type { Graphics } from "pixi.js";
import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import {
  bodyGrids,
  buildTerrainFromLevel,
  clearCrater,
  getCellInfo,
  isSolidAt,
  setSampleFrozen,
  terrainBodies,
  type TerrainGrid,
} from "@/features/arena/api/arenaApi";
import type { LevelDefinition, TerrainPiece } from "@/features/level/api/levelApi";
import { createPlayer } from "@/features/player/api/playerApi";
import {
  createFireView,
  easeFlames,
  flameBlocks,
  syncFireView,
  type FireFrame,
} from "@/features/fire/services/fireRenderer";
import { clusterFlames, type ClusterFlame } from "@/features/fire/services/flameShapes";
import {
  burningSamples,
  createFireState,
  ignite,
  stepFire,
} from "@/features/fire/services/fireSim";
import { sprayTorch } from "@/features/fire/services/torch";
import type { FireState } from "@/features/fire/types/fire.types";

const F = DEFAULT_GAME_TUNABLES.fire;
const CELL = 4;
const dt = 1 / 120;
/** Seconds the fire needs to spread `units` world units. */
const spreadFor = (units: number): number => units / F.spreadSpeed;

const rect = (
  [x, y, w, h]: readonly [number, number, number, number],
  materialId: string
): TerrainPiece => ({ shape: { type: "rect", x, y, w, h }, materialId });

const world = (terrain: TerrainPiece[]): LevelDefinition => ({
  formatVersion: 2,
  meta: { levelId: "f", title: "F" },
  settings: { cellSize: CELL, gravity: 1 },
  worldSize: { w: 400, h: 400 },
  terrain,
  spawns: [],
  drops: [],
  collectibles: [],
  bounds: { x: 0, y: 0, w: 400, h: 400 },
});

interface Burn {
  grid: TerrainGrid;
  fire: FireState;
  time: number;
  /** Sample index at a world point. */
  at: (x: number, y: number) => number;
  run: (seconds: number) => void;
  light: (x: number, y: number) => void;
}

const burn = (terrain: TerrainPiece[]): Burn => {
  const grid = buildTerrainFromLevel(world(terrain));
  const fire = createFireState(grid);
  const state: Burn = {
    grid,
    fire,
    time: 0,
    at: (x, y) => Math.floor(y / CELL) * grid.widthCells + Math.floor(x / CELL),
    run: (seconds) => {
      const end = state.time + seconds;
      while (state.time < end - 1e-9) {
        state.time += dt;
        stepFire(fire, grid, { now: state.time, tunables: DEFAULT_GAME_TUNABLES });
      }
    },
    light: (x, y) => {
      ignite(fire, grid, { body: 0, index: state.at(x, y), time: state.time });
    },
  };
  return state;
};

/** Centre of the sample a point is in. */
const centre = (v: number): number => (Math.floor(v / CELL) + 0.5) * CELL;

describe("fireSim — spread (blast-power D5, D6)", () => {
  it("should reach fuel along an axis exactly at distance over spread speed when lit", () => {
    const b = burn([rect([0, 100, 400, 200], "cardboard")]);
    b.light(202, 202);
    b.run(spreadFor(40));
    for (const d of [8, 20, 36]) {
      const arrival = b.fire.grounds[0]!.igniteAt[b.at(202 + d, 202)]!;
      expect(arrival).toBeCloseTo(d / F.spreadSpeed, 4);
    }
  });

  it("should spread the same in every direction within 8 % when lit in solid fuel", () => {
    const b = burn([rect([0, 100, 400, 200], "cardboard")]);
    b.light(202, 202);
    b.run(spreadFor(48));
    for (let deg = 0; deg <= 90; deg += 15) {
      const a = (deg * Math.PI) / 180;
      const x = centre(202 + Math.cos(a) * 40);
      const y = centre(202 + Math.sin(a) * 40);
      const distance = Math.hypot(x - 202, y - 202);
      const arrival = b.fire.grounds[0]!.igniteAt[b.at(x, y)]!;
      expect(Math.abs(arrival * F.spreadSpeed - distance) / distance, `${deg}°`).toBeLessThan(0.08);
    }
  });

  it("should never cross a gap of air when two fuel pieces are apart", () => {
    const b = burn([rect([100, 100, 40, 40], "cardboard"), rect([144, 100, 40, 40], "cardboard")]);
    b.light(110, 110);
    b.run(spreadFor(120));
    expect(b.fire.grounds[0]!.igniteAt[b.at(150, 110)]).toBe(Infinity);
  });

  it("should not pass through a corner of air when fuel touches only diagonally", () => {
    const b = burn([rect([100, 100, 8, 8], "cardboard"), rect([108, 108, 8, 8], "cardboard")]);
    b.light(102, 102);
    b.run(spreadFor(80));
    expect(b.fire.grounds[0]!.igniteAt[b.at(110, 110)]).toBe(Infinity);
  });

  it("should flow around stone when stone sits in the fuel", () => {
    const b = burn([rect([100, 100, 120, 60], "cardboard"), rect([150, 100, 20, 40], "stone")]);
    b.light(110, 110);
    b.run(spreadFor(200));
    const far = b.at(190, 110);
    expect(b.fire.grounds[0]!.igniteAt[far]).toBeLessThan(Infinity);
    // The way round the stone is longer than the straight line.
    expect(b.fire.grounds[0]!.igniteAt[far]! * F.spreadSpeed).toBeGreaterThan(80 + 1);
    expect(b.fire.grounds[0]!.igniteAt[b.at(158, 110)]).toBe(Infinity);
  });

  it("should scorch earth and stop at it when fire reaches earth", () => {
    const b = burn([rect([100, 100, 40, 40], "cardboard"), rect([140, 100, 40, 40], "earth")]);
    b.light(110, 110);
    b.run(spreadFor(80));
    expect(b.fire.grounds[0]!.igniteAt[b.at(142, 110)]).toBe(Infinity);
    expect(b.fire.grounds[0]!.scorched[b.at(142, 110)]).toBe(1);
    expect(getCellInfo(b.grid, 35, 27)?.materialId).toBe("earth");
  });

  it("should never light cardboard touching ice when the fire comes near", () => {
    const b = burn([rect([100, 100, 40, 40], "cardboard"), rect([140, 100, 20, 40], "ice")]);
    b.light(110, 110);
    b.run(spreadFor(80));
    expect(b.fire.grounds[0]!.igniteAt[b.at(138, 110)]).toBe(Infinity);
    expect(b.fire.grounds[0]!.igniteAt[b.at(130, 110)]).toBeLessThan(Infinity);
  });

  it("should not count a sample as burning when it froze while waiting to catch (fire-ice seam)", () => {
    const b = burn([rect([100, 100, 40, 40], "cardboard")]);
    b.light(110, 110);
    b.run(dt);
    // The next sample over is queued to catch; ice reaches it first.
    const seam = b.at(114, 110);
    const ground = b.fire.grounds[0]!;
    expect(ground.igniteAt[seam]).toBeGreaterThan(b.time);
    setSampleFrozen(b.grid, seam, true);
    b.run(spreadFor(12));
    // One state: what blob damage reads (`igniteAt` due) is what the renderer draws (burning).
    expect(burningSamples(ground)).not.toContain(seam);
    expect(ground.igniteAt[seam]).toBe(Infinity);
  });

  it("should light samples that catch at the same moment in index order when two are lit together", () => {
    const b = burn([rect([100, 100, 40, 40], "cardboard")]);
    ignite(b.fire, b.grid, { body: 0, index: b.at(130, 110), time: 0 });
    ignite(b.fire, b.grid, { body: 0, index: b.at(110, 110), time: 0 });
    b.run(dt);
    expect(b.fire.grounds[0]!.lit.slice(0, 2)).toEqual([b.at(110, 110), b.at(130, 110)]);
  });
});

describe("fireSim — burn-out (blast-power D6)", () => {
  it("should remove a lit sample after the burn time in the next batch when it burns out", () => {
    const b = burn([rect([100, 100, 40, 40], "cardboard")]);
    b.light(110, 110);
    const index = b.at(110, 110);
    b.run(F.burnSeconds - 0.05);
    expect(getCellInfo(b.grid, 27, 27)).not.toBeNull();
    b.run(0.05 + F.burnOutInterval + dt);
    expect(getCellInfo(b.grid, 27, 27)).toBeNull();
    expect(burningSamples(b.fire.grounds[0]!)).not.toContain(index);
  });

  it("should report the burnt cardboard once per batch when samples burn out", () => {
    const b = burn([rect([100, 100, 40, 40], "cardboard")]);
    b.light(110, 110);
    // Long enough for the whole 40 × 40 piece to catch and for several batches to burn out.
    const window = F.burnSeconds + spreadFor(60);
    const reports: number[] = [];
    for (let t = 0; t < window; t += dt) {
      b.time += dt;
      const cleared = stepFire(b.fire, b.grid, { now: b.time, tunables: DEFAULT_GAME_TUNABLES });
      if (cleared) reports.push(cleared.byLook[0]?.cells ?? 0);
    }
    expect(reports.length).toBeGreaterThan(1);
    expect(reports.length).toBeLessThanOrEqual(Math.ceil(window / F.burnOutInterval) + 1);
  });

  it("should place a batch's debris spots on burnt samples when two separate pieces burn out together", () => {
    // Two pieces 120 apart, lit at the same moment: the middle of the batch's box is open air.
    const pieces = [
      [40, 100, 40, 40],
      [200, 100, 40, 40],
    ] as const;
    const b = burn(pieces.map((piece) => rect(piece, "cardboard")));
    b.light(60, 120);
    b.light(220, 120);
    const spots: { x: number; y: number }[] = [];
    for (let t = 0; t < F.burnSeconds + spreadFor(60); t += dt) {
      b.time += dt;
      const batch = stepFire(b.fire, b.grid, { now: b.time, tunables: DEFAULT_GAME_TUNABLES });
      if (batch) spots.push(...batch.spots);
    }
    expect(spots.length).toBeGreaterThan(0);
    const inPiece = (spot: { x: number; y: number }) =>
      pieces.some(([x, y, w, h]) => spot.x > x && spot.x < x + w && spot.y > y && spot.y < y + h);
    expect(spots.every(inPiece)).toBe(true);
    expect(spots.some((spot) => spot.x < 80)).toBe(true);
    expect(spots.some((spot) => spot.x > 200)).toBe(true);
  });

  it("should give a batch at most three debris spots and a small one just one when samples burn out", () => {
    const b = burn([rect([100, 100, 120, 60], "cardboard")]);
    b.light(110, 110);
    const counts: number[] = [];
    for (let t = 0; t < F.burnSeconds + spreadFor(40); t += dt) {
      b.time += dt;
      const batch = stepFire(b.fire, b.grid, { now: b.time, tunables: DEFAULT_GAME_TUNABLES });
      if (batch) counts.push(batch.spots.length);
    }
    expect(counts[0]).toBe(1);
    expect(Math.max(...counts)).toBeLessThanOrEqual(3);
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(1);
  });

  it("should keep burning around a crater when a blast removes burning samples", () => {
    const b = burn([rect([100, 100, 120, 60], "cardboard")]);
    b.light(110, 110);
    b.run(spreadFor(20));
    expect(() => {
      clearCrater(b.grid, { x: 112, y: 112, reach: 12, shape: "round" });
      b.run(spreadFor(120));
    }).not.toThrow();
    expect(b.fire.grounds[0]!.igniteAt[b.at(200, 150)]).toBeLessThan(Infinity);
  });

  it("should leave fire unlit when a rocket blast cuts cardboard", () => {
    const b = burn([rect([100, 100, 120, 60], "cardboard")]);
    clearCrater(b.grid, { x: 150, y: 100, reach: 34, shape: "round" });
    b.run(1);
    expect(burningSamples(b.fire.grounds[0]!)).toEqual([]);
  });
});

const PART_TUNABLES = DEFAULT_GAME_TUNABLES;
const PF = PART_TUNABLES.fire;
const PART_CELL = 4;
const PART_FLOOR = 200;
const partDt = 1 / 60;

/** A stone floor and one moving part (piece 1): a 120 × 40 slab at x 240–360, y 100–140. */
function partScene(materialId: string) {
  const part: TerrainPiece = { shape: { type: "rect", x: 240, y: 100, w: 120, h: 40 }, materialId };
  const level: LevelDefinition = {
    formatVersion: 2,
    meta: { levelId: "p", title: "P" },
    settings: { cellSize: PART_CELL, gravity: 1 },
    worldSize: { w: 600, h: 300 },
    terrain: [
      { shape: { type: "rect", x: 0, y: PART_FLOOR, w: 600, h: 40 }, materialId: "stone" },
      part,
    ],
    spawns: [],
    drops: [],
    collectibles: [],
    bounds: { x: 0, y: 0, w: 600, h: 300 },
    movers: [
      {
        motion: { kind: "slide", offset: { x: 0, y: -60 }, periodS: 4, phase: 0 },
        pivot: { x: 300, y: 120 },
        terrainIndices: [1],
      },
    ],
  };
  const terrain = buildTerrainFromLevel(level);
  const fire = createFireState(terrain);
  const field = bodyGrids(terrain)[1]!;
  /** The part's sample at a world point (in the part's pose now). */
  const at = (x: number, y: number): number => {
    const local = terrainBodies(terrain)[1]!.toLocal!({ x, y })!;
    return Math.floor(local.y / PART_CELL) * field.widthCells + Math.floor(local.x / PART_CELL);
  };
  const world = { time: 0 };
  const run = (seconds: number) => {
    let last: ReturnType<typeof stepFire> = null;
    for (let i = 0; i < Math.round(seconds / partDt); i += 1) {
      world.time += partDt;
      last = stepFire(fire, terrain, { now: world.time, tunables: PART_TUNABLES }) ?? last;
    }
    return last;
  };
  return { terrain, fire, field, part: terrain.movers[0]!, at, run, world };
}

describe("fire on moving parts (mover-materials-l2)", () => {
  it("should spread through a cardboard part at the fire's speed when one of its samples is lit", () => {
    const s = partScene("cardboard");
    expect(ignite(s.fire, s.terrain, { body: 1, index: s.at(250, 120), time: 0 })).toBe(true);
    s.run(60 / PF.spreadSpeed + 0.5);
    const ground = s.fire.grounds[1]!;
    // 60 units along the part: distance ÷ speed, within one sample's step.
    expect(ground.igniteAt[s.at(310, 120)]).toBeCloseTo(60 / PF.spreadSpeed, 0);
    expect(burningSamples(ground).length).toBeGreaterThan(0);
    // The fire stays on the part: nothing lit on the static terrain.
    expect(burningSamples(s.fire.grounds[0]!)).toEqual([]);
  });

  it("should not light a part when its material does not burn", () => {
    const s = partScene("stone");
    expect(ignite(s.fire, s.terrain, { body: 1, index: s.at(250, 120), time: 0 })).toBe(false);
  });

  it("should light the part's sample the torch touches when the torch is held on a cardboard part", () => {
    const s = partScene("cardboard");
    const holder = createPlayer(0, { x: 200, y: 134 }, PART_TUNABLES);
    holder.aimX = 1;
    holder.aimY = 0;
    sprayTorch(s.fire, {
      terrain: s.terrain,
      players: [holder],
      holder,
      tunables: PART_TUNABLES,
      now: 0,
      dt: partDt,
    });
    s.run(0.2);
    expect(burningSamples(s.fire.grounds[1]!).length).toBeGreaterThan(0);
    expect(burningSamples(s.fire.grounds[0]!)).toEqual([]);
  });

  it("should cut burnt samples out of the part's field, where the part is, when they burn out", () => {
    const s = partScene("cardboard");
    // The part has moved up 60: its fire and its burn-out follow it.
    s.part.pose = { dx: 0, dy: -60, angle: 0 };
    const index = s.at(250, 60);
    ignite(s.fire, s.terrain, { body: 1, index, time: 0 });
    expect(isSolidAt(s.terrain, 250, 60)).toBe(true);
    const batch = s.run(PF.burnSeconds + PF.burnOutInterval + 2 * partDt);
    expect(s.field.cells[index]).toBe(0);
    expect(isSolidAt(s.terrain, 250, 60)).toBe(false);
    expect(batch?.byLook.map((look) => look.materialId)).toEqual(["cardboard"]);
    // The debris flies from the part in the world, not from its rest pose.
    for (const spot of batch?.spots ?? []) {
      expect(spot.y).toBeGreaterThan(40);
      expect(spot.y).toBeLessThan(80);
    }
  });
});

const VIEW_TUNABLES = DEFAULT_GAME_TUNABLES;

// A stone floor and one cardboard part (piece 1) that slides up 60.
const partLevel: LevelDefinition = {
  formatVersion: 2,
  meta: { levelId: "r", title: "R" },
  settings: { cellSize: 4, gravity: 1 },
  worldSize: { w: 600, h: 300 },
  terrain: [
    { shape: { type: "rect", x: 0, y: 200, w: 600, h: 40 }, materialId: "stone" },
    { shape: { type: "rect", x: 240, y: 100, w: 120, h: 40 }, materialId: "cardboard" },
  ],
  movers: [
    {
      motion: { kind: "slide", offset: { x: 0, y: -60 }, periodS: 4, phase: 0 },
      pivot: { x: 300, y: 120 },
      terrainIndices: [1],
    },
  ],
  spawns: [],
  drops: [],
  collectibles: [],
  bounds: { x: 0, y: 0, w: 600, h: 300 },
};

/** The part burning from its middle for a second, and the frame the renderer gets. */
function burningPart() {
  const terrain = buildTerrainFromLevel(partLevel);
  const fire = createFireState(terrain);
  const field = bodyGrids(terrain)[1]!;
  const middle =
    Math.floor(field.heightCells / 2) * field.widthCells + Math.floor(field.widthCells / 2);
  ignite(fire, terrain, { body: 1, index: middle, time: 0 });
  for (let t = 1 / 60; t <= 1; t += 1 / 60)
    stepFire(fire, terrain, { now: t, tunables: VIEW_TUNABLES });
  const frame: FireFrame = {
    fire,
    terrain,
    nowMs: 1000,
    players: [],
    timeSeconds: 1,
    zoom: 1,
    torchHolderIds: new Set(),
    torchLength: VIEW_TUNABLES.combat.torch.length,
    burnSeconds: VIEW_TUNABLES.fire.burnSeconds,
  };
  return { terrain, frame };
}

describe("fire layers per body (mover-materials-l2 D3, D4)", () => {
  it("should draw a burning part's fire in the part's own layer and none on the terrain's", () => {
    const { frame } = burningPart();
    const view = createFireView();
    syncFireView(view, frame);
    expect(view.grounds).toHaveLength(2);
    expect(view.grounds[1]!.body.fill.getLocalBounds().width).toBeGreaterThan(0);
    expect(view.grounds[0]!.body.fill.getLocalBounds().width).toBe(0);
  });

  it("should draw the burning body's ink as strokes only, never a shape under the fill", () => {
    const { frame } = burningPart();
    const view = createFireView();
    syncFireView(view, frame);
    const tiles = view.grounds[1]!.body.ink.children as Graphics[];
    const drawn = tiles
      .map((g) => g.context.instructions.map((instruction) => instruction.action))
      .filter((list) => list.length > 0);
    expect(drawn.length).toBeGreaterThan(0);
    for (const list of drawn) expect(list).toEqual(["stroke"]);
  });

  it("should move the part's fire layer with the part when the part's pose changes", () => {
    const { terrain, frame } = burningPart();
    const view = createFireView();
    syncFireView(view, frame);
    const layer = view.grounds[1]!.layer;
    expect(layer.position.y - layer.pivot.y).toBeCloseTo(0, 6);
    terrain.movers[0]!.pose = { dx: 0, dy: -60, angle: 0 };
    syncFireView(view, frame);
    expect(layer.position.y - layer.pivot.y).toBeCloseTo(-60, 6);
  });
});

describe("flames on a turned part (fire-on-rotating-parts)", () => {
  /** The whole part burning, turned half round about its pivot: its rest-pose top is now its bottom. */
  function turnedPart(angle: number) {
    const { terrain, frame } = burningPart();
    const ground = frame.fire.grounds[1]!;
    const field = bodyGrids(terrain)[1]!;
    ground.lit = [];
    field.cells.forEach((slot, index) => {
      if (slot === 0) return;
      ground.lit.push(index);
      ground.igniteAt[index] = 0;
    });
    ground.litHead = 0;
    ground.dueOut = [];
    ground.version += 1;
    terrain.movers[0]!.pose = { dx: 0, dy: 0, angle };
    return { terrain, frame };
  }
  // The slab is x 240–360, y 100–140 in the world, turned or not (it turns about its middle).
  const TOP = 100;
  const BOTTOM = 140;

  it("should root the flames on the part's world top edge when the part is turned half round", () => {
    for (const angle of [0, Math.PI]) {
      const { terrain, frame } = turnedPart(angle);
      const blocks = flameBlocks({
        fire: frame.fire.grounds[1]!,
        world: terrain,
        body: 1,
        timeSeconds: frame.timeSeconds,
      });
      const tops = [...blocks.values()].filter(
        (block) => !blocks.has((block.by - 1) * terrain.widthCells + block.bx)
      );
      expect(tops.length).toBeGreaterThan(0);
      for (const block of tops) {
        expect(block.y).toBeGreaterThan(TOP - 1);
        expect(block.y).toBeLessThan(TOP + 2 * terrain.cellSize);
      }
    }
  });

  it("should make the flames rise world-up from a part turned half round, not hang below it", () => {
    const { frame } = turnedPart(Math.PI);
    const view = createFireView();
    syncFireView(view, frame);
    const bounds = view.grounds[1]!.flames.getBounds();
    expect(bounds.height).toBeGreaterThan(0);
    // Above the part's top edge, never down past its middle or out under its bottom.
    expect(bounds.minY).toBeLessThan(TOP);
    expect(bounds.maxY).toBeLessThan((TOP + BOTTOM) / 2);
  });
});

describe("flames on a turning part ease (fire-rotating-ease)", () => {
  /** The whole part burning; its flames over 40 frames at 60 fps, turning 0.75° a frame. */
  function turningFlames(ease: boolean) {
    const { terrain, frame } = burningPart();
    const ground = frame.fire.grounds[1]!;
    ground.lit = [];
    bodyGrids(terrain)[1]!.cells.forEach((slot, index) => {
      if (slot === 0) return;
      ground.lit.push(index);
      ground.igniteAt[index] = 0;
    });
    ground.litHead = 0;
    ground.dueOut = [];
    const size = terrain.cellSize * 2;
    const memo = { flames: [] as ClusterFlame[], atMs: -1 };
    const frames: ClusterFlame[][] = [];
    for (let k = 0; k < 40; k += 1) {
      terrain.movers[0]!.pose = { dx: 0, dy: 0, angle: (k * 0.75 * Math.PI) / 180 };
      const blocks = flameBlocks({ fire: ground, world: terrain, body: 1, timeSeconds: 5 });
      // A fixed flicker clock: only the turn changes between frames.
      const raw = clusterFlames(blocks, {
        size,
        stride: terrain.widthCells,
        timeSeconds: 5,
        burnSeconds: 20,
      });
      frames.push(ease ? easeFlames(memo, raw, { nowMs: (k * 1000) / 60, size }) : raw);
    }
    return frames.slice(10);
  }

  /** Largest change of a flame's root and height from one frame to the next, flame by flame in its column. */
  function largestStep(frames: ClusterFlame[][]) {
    const step = { y: 0, height: 0 };
    frames.slice(1).forEach((flames, i) => {
      for (const flame of flames) {
        const before = frames[i]!.find(
          (prev) => prev.x === flame.x && Math.abs(prev.y - flame.y) < 12
        );
        if (!before) continue;
        step.y = Math.max(step.y, Math.abs(before.y - flame.y));
        step.height = Math.max(step.height, Math.abs(before.height - flame.height));
      }
    });
    return step;
  }

  it("should jump by up to a block per frame when the flames follow their blocks as they are", () => {
    // The cause: the part's surface moves under 1 unit a frame, its flames jump far more.
    const step = largestStep(turningFlames(false));
    expect(step.y).toBeGreaterThan(4);
    expect(step.height).toBeGreaterThan(6);
  });

  it("should move the flames less than a quarter block a frame when they ease", () => {
    const step = largestStep(turningFlames(true));
    expect(step.y).toBeLessThan(2);
    expect(step.height).toBeLessThan(2.5);
  });

  it("should leave a flame where it is when its block's flame does not move", () => {
    const memo = { flames: [] as ClusterFlame[], atMs: -1 };
    const flame: ClusterFlame = { x: 4, y: 100, width: 5, height: 9, sway: 0, age: 1 };
    easeFlames(memo, [flame], { nowMs: 0, size: 8 });
    const [after] = easeFlames(memo, [flame], { nowMs: 16, size: 8 });
    expect(after).toEqual(flame);
  });
});
