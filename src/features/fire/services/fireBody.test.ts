import { Graphics } from "pixi.js";
import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import {
  buildTerrainFromLevel,
  drawContour,
  markedRegion,
  surfaceTiles,
  terrainContour,
} from "@/features/arena/api/arenaApi";
import { createFireBodyView, syncFireBody } from "@/features/fire/services/fireBody";
import {
  burningSamples,
  createFireState,
  ignite,
  stepFire,
} from "@/features/fire/services/fireSim";

// A long cardboard slab on stone: two fires far apart, so they burn in different tiles.
const level: LevelDefinition = {
  formatVersion: 2,
  meta: { levelId: "b", title: "B" },
  settings: { cellSize: 4, gravity: 1 },
  worldSize: { w: 800, h: 300 },
  terrain: [
    { shape: { type: "rect", x: 0, y: 200, w: 800, h: 60 }, materialId: "stone" },
    { shape: { type: "rect", x: 20, y: 120, w: 760, h: 80 }, materialId: "cardboard" },
  ],
  spawns: [],
  drops: [],
  collectibles: [],
  bounds: { x: 0, y: 0, w: 800, h: 300 },
};

function twoFires(seconds: number) {
  const terrain = buildTerrainFromLevel(level);
  const fire = createFireState(terrain);
  for (const x of [40, 160])
    ignite(fire, terrain, { body: 0, index: 32 * terrain.widthCells + x, time: 0 });
  for (let t = 1 / 60; t <= seconds; t += 1 / 60) {
    stepFire(fire, terrain, { now: t, tunables: DEFAULT_GAME_TUNABLES });
  }
  return { terrain, fire: fire.grounds[0]! };
}

const sync = (
  body: ReturnType<typeof createFireBodyView>,
  at: ReturnType<typeof twoFires>,
  t: number
) =>
  syncFireBody(body, {
    ...at,
    timeSeconds: t,
    burnSeconds: DEFAULT_GAME_TUNABLES.fire.burnSeconds,
    ink: 2,
    inkColor: 0,
  });

describe("fire body in surface tiles (tree-fire-perf)", () => {
  it("should fill each tile exactly as one march over all burning samples does when two fires burn", () => {
    const at = twoFires(3);
    const body = createFireBodyView();
    sync(body, at, 3);
    const region = markedRegion(at.terrain, burningSamples(at.fire))!;
    const tiles = surfaceTiles(at.terrain);
    const fills = body.fill.children as Graphics[];
    let compared = 0;
    tiles.forEach((cells, id) => {
      const expected = new Graphics();
      const any = drawContour(expected, terrainContour(at.terrain, { grow: 0, region, cells }), 0);
      const drawn = body.tiles[id]?.drawn?.fill;
      if (!any) {
        expect(drawn?.getLocalBounds().width ?? 0).toBe(0);
        return;
      }
      compared += 1;
      expect(fills).toContain(drawn);
      const [a, b] = [drawn!.getLocalBounds(), expected.getLocalBounds()];
      // Equal up to the Float32 the marked region caches its values in.
      for (const k of ["x", "y", "width", "height"] as const) expect(a[k]).toBeCloseTo(b[k], 6);
    });
    expect(compared).toBeGreaterThan(1);
  });

  it("should redraw only the tiles whose fire changed when one fire grows", () => {
    const at = twoFires(3);
    const body = createFireBodyView();
    sync(body, at, 3);
    const keys = body.tiles.map((tile) => tile.key);
    // A third fire far from both: only the tiles around it change.
    const index = 32 * at.terrain.widthCells + 100;
    at.fire.front.arriveAt[index] = 3;
    at.fire.lit.push(index);
    at.fire.version += 1;
    sync(body, at, 3);
    const changed = body.tiles.filter((tile, i) => tile.key !== keys[i]);
    expect(changed.length).toBeGreaterThan(0);
    expect(changed.length).toBeLessThanOrEqual(4);
  });
});
