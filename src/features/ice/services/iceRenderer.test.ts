import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import { buildTerrainFromLevel, setSampleFrozen } from "@/features/arena/api/arenaApi";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import { createIceView, syncIceView, type IceFrame } from "@/features/ice/services/iceRenderer";
import { createIceState } from "@/features/ice/services/iceSim";

// A stone floor and one cardboard part (piece 1) that slides up 60.
const level: LevelDefinition = {
  formatVersion: 2,
  meta: { levelId: "f", title: "F" },
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

/** The part frozen all over, and the frame the renderer gets. */
function frozenPart() {
  const terrain = buildTerrainFromLevel(level);
  const field = terrain.movers[0]!.field;
  field.cells.forEach((slot, index) => {
    if (slot !== 0) setSampleFrozen(field, index, true);
  });
  const frame: IceFrame = {
    ice: createIceState(terrain),
    terrain,
    players: [],
    blob: DEFAULT_GAME_TUNABLES.ice.blob,
    nowMs: 0,
    timeSeconds: 0,
    zoom: 1,
  };
  return { terrain, frame };
}

describe("frost layers per body (mover-materials lap 2b)", () => {
  it("should draw a frozen part's frost in the part's own layer and none on the terrain's", () => {
    const { frame } = frozenPart();
    const view = createIceView();
    syncIceView(view, frame);
    expect(view.grounds).toHaveLength(2);
    expect(view.grounds[1]!.frostLip.getLocalBounds().width).toBeGreaterThan(100);
    expect(view.grounds[0]!.frostLip.getLocalBounds().width).toBe(0);
  });

  it("should move the part's frost layer with the part when the part's pose changes", () => {
    const { terrain, frame } = frozenPart();
    const view = createIceView();
    syncIceView(view, frame);
    const layer = view.grounds[1]!.layer;
    expect(layer.position.y - layer.pivot.y).toBeCloseTo(0, 6);
    terrain.movers[0]!.pose = { dx: 0, dy: -60, angle: 0 };
    syncIceView(view, frame);
    expect(layer.position.y - layer.pivot.y).toBeCloseTo(-60, 6);
  });
});
