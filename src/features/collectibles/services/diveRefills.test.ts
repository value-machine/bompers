import { describe, expect, it } from "vitest";
import { isInJuiceWindow, isJuiceSquash } from "@/shared/config/gameJuice";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import { outlineWidth } from "@/shared/utils/outlineWidth";
import type { LevelCollectible } from "@/features/level/api/levelApi";
import { createPlayer, type PlayerState } from "@/features/player/api/playerApi";
import {
  DIVE_REFILL_ITEM,
  createDiveRefills,
  stepDiveRefills,
} from "@/features/collectibles/services/diveRefills";
import {
  createDiveRefillLayer,
  DIVE_REFILL_LOOK,
  diveRefillPhase,
  diveRefillWobble,
  syncDiveRefillLayer,
} from "@/features/collectibles/services/diveRefillRenderer";
import type { DiveRefillPickup } from "@/features/collectibles/types/collectibles.types";

const tunables = DEFAULT_GAME_TUNABLES;
const { respawnSeconds, size } = tunables.collectibles.diveRefill;
const dt = 1 / 120;
const points: LevelCollectible[] = [
  { at: { x: 100, y: 200 }, itemId: "point-orb" },
  { at: { x: 300, y: 200 }, itemId: DIVE_REFILL_ITEM },
  { at: { x: 500, y: 200 }, itemId: DIVE_REFILL_ITEM },
];

/** A player whose body overlaps the point at `x` (feet a little below the point). */
const playerAt = (slot: number, x: number): PlayerState =>
  createPlayer(slot, { x, y: 210 }, tunables);

function run(refills: DiveRefillPickup[], seconds: number, players: PlayerState[] = []) {
  const collected = [];
  for (let t = 0; t < seconds - 1e-9; t += dt) {
    collected.push(...stepDiveRefills({ refills, players, tunables, dt }));
  }
  return collected;
}

describe("diveRefills", () => {
  it("should place one present pickup on each dive-reset point when the match starts", () => {
    const refills = createDiveRefills(points);
    expect(refills.map((refill) => [refill.pointIndex, refill.x, refill.y])).toEqual([
      [1, 300, 200],
      [2, 500, 200],
    ]);
    expect(refills.every((refill) => refill.respawnTimer === 0)).toBe(true);
  });

  it("should give the pickup to the player touching it and take it away when it is collected", () => {
    const refills = createDiveRefills(points);
    const collected = stepDiveRefills({ refills, players: [playerAt(3, 300)], tunables, dt });
    expect(collected).toEqual([{ slot: 3, x: 300, y: 200 }]);
    expect(refills[0]!.respawnTimer).toBeCloseTo(respawnSeconds);
    expect(refills[1]!.respawnTimer).toBe(0);
  });

  it("should not be taken again when a player touches it while it is gone", () => {
    const refills = createDiveRefills(points);
    run(refills, dt, [playerAt(0, 300)]);
    const again = run(refills, respawnSeconds - 0.1, [playerAt(1, 300)]);
    expect(again).toEqual([]);
  });

  it("should come back on its point when the respawn time has passed", () => {
    const refills = createDiveRefills(points);
    run(refills, dt, [playerAt(0, 300)]);
    run(refills, respawnSeconds);
    expect(refills[0]!.respawnTimer).toBe(0);
    expect(run(refills, dt, [playerAt(1, 300)])).toEqual([{ slot: 1, x: 300, y: 200 }]);
  });

  it("should let a player take only one pickup when two overlap in the same step", () => {
    const refills = createDiveRefills([
      { at: { x: 300, y: 200 }, itemId: DIVE_REFILL_ITEM },
      { at: { x: 304, y: 200 }, itemId: DIVE_REFILL_ITEM },
    ]);
    expect(run(refills, dt, [playerAt(0, 300)])).toHaveLength(1);
    expect(refills[1]!.respawnTimer).toBe(0);
  });
});

// The look (diveRefillRenderer.ts) is tested here: the collectibles services layer is at its
// 10-file budget, and this is the same pickup.
const lookRefill = (respawnTimer: number, presentSeconds = 0): DiveRefillPickup => ({
  pointIndex: 0,
  x: 0,
  y: 0,
  respawnTimer,
  presentSeconds,
});

describe("headbutt reset bubble look", () => {
  it("should keep the pop-in and the pop inside their juice windows when timed", () => {
    expect(isInJuiceWindow("squash", DIVE_REFILL_LOOK.popInSeconds)).toBe(true);
    expect(isInJuiceWindow("linger", DIVE_REFILL_LOOK.popSeconds)).toBe(true);
  });

  it("should keep the idle wobble inside the squash band when sampled over a period", () => {
    for (let ms = 0; ms < DIVE_REFILL_LOOK.wobble.periodMs; ms += 37) {
      expect(isJuiceSquash(diveRefillWobble(ms, 0))).toBe(true);
    }
  });

  it("should draw the bubble smaller than a blob when sized from the touch box", () => {
    const blobRadius = DEFAULT_GAME_TUNABLES.player.height / 2;
    expect(size * DIVE_REFILL_LOOK.radiusFraction).toBeLessThan(blobRadius);
  });

  it("should pop, then regrow from small to near full when taken", () => {
    const args = { respawnSeconds };
    expect(diveRefillPhase(lookRefill(0, 1), args)).toEqual({ kind: "present", popIn: 1 });
    const pop = diveRefillPhase(lookRefill(respawnSeconds - 0.1), args);
    expect(pop.kind).toBe("popping");
    const early = diveRefillPhase(
      lookRefill(respawnSeconds - DIVE_REFILL_LOOK.popSeconds - 0.01),
      args
    );
    const late = diveRefillPhase(lookRefill(0.01), args);
    expect(early.kind).toBe("regrowing");
    expect(late.kind).toBe("regrowing");
    if (early.kind !== "regrowing" || late.kind !== "regrowing") return;
    expect(early.grow).toBeLessThan(0.35);
    expect(late.grow).toBeGreaterThan(0.9);
  });

  it("should overshoot on the pop-in when it has just come back", () => {
    const phase = diveRefillPhase(lookRefill(0, DIVE_REFILL_LOOK.popInSeconds * 0.7), {
      respawnSeconds,
    });
    expect(phase.kind).toBe("present");
    if (phase.kind === "present") expect(phase.popIn).toBeGreaterThan(1);
  });
});

describe("headbutt reset layer", () => {
  it("should show the bubble, the pop, then the regrowing ghost when the pickup is taken", () => {
    const layer = createDiveRefillLayer();
    const frame = (pickup: DiveRefillPickup) => ({
      refills: [pickup],
      size,
      outline: outlineWidth("prop", 1),
      respawnSeconds,
      nowMs: 400,
    });
    const visible = (): boolean[] => {
      const sprite = [...layer.sprites.values()][0]!;
      return sprite.children.map((child) => child.visible);
    };
    // Children order: ghost, pop, bubble.
    syncDiveRefillLayer(layer, frame(lookRefill(0, 1)));
    expect(visible()).toEqual([false, false, true]);
    syncDiveRefillLayer(layer, frame(lookRefill(respawnSeconds - 0.1)));
    expect(visible()).toEqual([false, true, false]);
    syncDiveRefillLayer(layer, frame(lookRefill(1)));
    expect(visible()).toEqual([true, false, false]);
  });
});
