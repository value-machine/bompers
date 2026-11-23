import { describe, expect, it } from "vitest";
import { isInJuiceWindow, isJuiceSquash } from "@/shared/config/gameJuice";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import {
  DIVE_REFILL_LOOK,
  diveRefillWobble,
} from "@/features/fixed-pickups/services/diveRefillRenderer";
import { fixedPickupPhase } from "@/features/fixed-pickups/services/fixedPickupPhase";
import {
  createFixedPickupsView,
  syncFixedPickupsView,
} from "@/features/fixed-pickups/services/fixedPickupsRenderer";
import {
  HEALTH_PICKUP_LOOK,
  healthPickupPose,
} from "@/features/fixed-pickups/services/healthPickupRenderer";
import type {
  FixedPickup,
  FixedPickupItem,
} from "@/features/fixed-pickups/types/fixedPickups.types";

const tunables = DEFAULT_GAME_TUNABLES;
const { respawnSeconds, size } = tunables.collectibles.diveRefill;
const health = tunables.collectibles.health;
const blobRadius = tunables.player.height / 2;

const pickupAt = (
  respawnTimer: number,
  presentSeconds = 0,
  itemId: FixedPickupItem = "dive-reset"
): FixedPickup => ({ itemId, pointIndex: 0, x: 0, y: 0, respawnTimer, presentSeconds });

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
    expect(size * DIVE_REFILL_LOOK.radiusFraction).toBeLessThan(blobRadius);
  });
});

describe("fixed pickup life cycle", () => {
  const args = { respawnSeconds, timing: DIVE_REFILL_LOOK };

  it("should pop, then regrow from small to near full when taken", () => {
    expect(fixedPickupPhase(pickupAt(0, 1), args)).toEqual({ kind: "present", popIn: 1 });
    expect(fixedPickupPhase(pickupAt(respawnSeconds - 0.1), args).kind).toBe("popping");
    const early = fixedPickupPhase(
      pickupAt(respawnSeconds - DIVE_REFILL_LOOK.popSeconds - 0.01),
      args
    );
    const late = fixedPickupPhase(pickupAt(0.01), args);
    if (early.kind !== "regrowing" || late.kind !== "regrowing") throw new Error("not regrowing");
    expect(early.grow).toBeLessThan(0.35);
    expect(late.grow).toBeGreaterThan(0.9);
  });

  it("should overshoot on the pop-in when it has just come back", () => {
    const phase = fixedPickupPhase(pickupAt(0, DIVE_REFILL_LOOK.popInSeconds * 0.7), args);
    expect(phase.kind === "present" && phase.popIn > 1).toBe(true);
  });
});

describe("health pickup candy look", () => {
  it("should keep the pop-in and the crack inside their juice windows when timed", () => {
    expect(isInJuiceWindow("squash", HEALTH_PICKUP_LOOK.popInSeconds)).toBe(true);
    expect(isInJuiceWindow("linger", HEALTH_PICKUP_LOOK.popSeconds)).toBe(true);
  });

  it("should barely deform when idle, staying inside the squash band", () => {
    for (let ms = 0; ms < HEALTH_PICKUP_LOOK.bob.periodMs; ms += 23) {
      const pose = healthPickupPose(ms, 0);
      expect(isJuiceSquash(pose)).toBe(true);
      expect(Math.abs(pose.sx - 1)).toBeLessThanOrEqual(HEALTH_PICKUP_LOOK.squash + 1e-9);
    }
  });

  it("should draw the heart narrower than a blob when sized from the touch box", () => {
    expect(health.size * HEALTH_PICKUP_LOOK.widthFraction).toBeLessThan(blobRadius * 2);
  });
});

describe("fixed pickups layer", () => {
  const frame = (pickup: FixedPickup) => ({ pickups: [pickup], tunables, nowMs: 400, zoom: 1 });
  const visible = (view: ReturnType<typeof createFixedPickupsView>): boolean[] =>
    [...view.sprites.values()][0]!.children.map((child) => child.visible);

  it("should show the pickup, the burst, then the regrowing ghost when a pickup is taken", () => {
    for (const [itemId, respawn] of [
      ["dive-reset", respawnSeconds],
      ["health", health.respawnSeconds],
    ] as const) {
      const view = createFixedPickupsView();
      // Children order: ghost, pop, pickup.
      syncFixedPickupsView(view, frame(pickupAt(0, 1, itemId)));
      expect(visible(view)).toEqual([false, false, true]);
      syncFixedPickupsView(view, frame(pickupAt(respawn - 0.1, 0, itemId)));
      expect(visible(view)).toEqual([false, true, false]);
      syncFixedPickupsView(view, frame(pickupAt(1, 0, itemId)));
      expect(visible(view)).toEqual([true, false, false]);
    }
  });
});
