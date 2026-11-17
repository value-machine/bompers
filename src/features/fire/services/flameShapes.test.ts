import { describe, expect, it } from "vitest";
import { isInJuiceWindow } from "@/shared/config/gameJuice";
import { DEFAULT_GAME_TUNABLES as GAME_TUNABLES } from "@/shared/config/gameTunables";
import {
  FLAME_LOOK,
  flameEnvelope,
  releasePuff,
  sprayFlame,
  terrainTongue,
  tonguePoints,
} from "@/features/fire/services/flameShapes";

const TORCH = GAME_TUNABLES.combat.torch;
const HALF = (TORCH.halfAngleDegrees * Math.PI) / 180;
const ORIGIN = { x: 100, y: 100 };

/** A level spray to the right: every ray reaches `reach` (the torch length unless blocked). */
const sprayRight = (reach = TORCH.length) => ({
  origin: ORIGIN,
  ends: Array.from({ length: TORCH.rays }, (_, i) => {
    const a = -HALF + (2 * HALF * i) / (TORCH.rays - 1);
    return { x: ORIGIN.x + Math.cos(a) * reach, y: ORIGIN.y + Math.sin(a) * reach };
  }),
});

const flameOf = (reach?: number, timeSeconds = 1.3) =>
  sprayFlame(sprayRight(reach), { timeSeconds, grow: 1, reach: TORCH.length });

/** The outline as points; index 0 is the nozzle, then one side out and the other side back. */
const outline = (neck: readonly number[]) =>
  Array.from({ length: neck.length / 2 }, (_, i) => ({ x: neck[i * 2]!, y: neck[i * 2 + 1]! }));

/** Half the gap between the two sides of the outline at step `k` from the nozzle. */
const halfWidthAt = (neck: readonly number[], k: number) => {
  const points = outline(neck);
  const out = points[k]!;
  const back = points[points.length - k]!;
  return { width: Math.hypot(out.x - back.x, out.y - back.y) / 2, along: out.x - ORIGIN.x };
};

describe("sprayFlame", () => {
  it("should open the neck to about half the hit cone when the spray is free", () => {
    const { layers } = flameOf();
    const steps = (layers[0].neck.length / 2 - 2) / 2 + 1;
    const { width, along } = halfWidthAt(layers[0].neck, Math.round(steps * 0.35));
    const cone = along * Math.tan(HALF);
    expect(width / cone).toBeGreaterThan(0.3);
    expect(width / cone).toBeLessThan(0.75);
  });

  it("should end in a head wider than the neck when the spray is free", () => {
    const { layers, headRadius } = flameOf();
    const steps = (layers[0].neck.length / 2 - 2) / 2 + 1;
    const neck = halfWidthAt(layers[0].neck, Math.round(steps * 0.35)).width;
    const lobes = layers[0].lobes;
    expect(lobes).toHaveLength(FLAME_LOOK.spray.lobes);
    const headTop = Math.min(...lobes.map((lobe) => lobe.y - lobe.r));
    const headBottom = Math.max(...lobes.map((lobe) => lobe.y + lobe.r));
    expect((headBottom - headTop) / 2).toBeGreaterThan(neck * 1.5);
    expect(headRadius).toBeGreaterThan(0);
  });

  it("should lift the head above the aim line when the spray is level", () => {
    expect(flameOf().head.y).toBeLessThan(ORIGIN.y);
  });

  it("should stay within the rays' reach when the spray is free or blocked", () => {
    for (const reach of [TORCH.length, 30]) {
      const { layers } = flameOf(reach);
      const far = Math.max(
        ...outline(layers[0].neck).map((p) => p.x - ORIGIN.x),
        ...layers[0].lobes.map((lobe) => lobe.x + lobe.r - ORIGIN.x)
      );
      expect(far).toBeLessThanOrEqual(reach * 1.1);
    }
  });

  it("should start at the nozzle when the spray is free", () => {
    const start = outline(flameOf().layers[0].neck)[0]!;
    expect(start.x - ORIGIN.x).toBeCloseTo(FLAME_LOOK.spray.nozzleReach);
  });

  it("should flare only where a ray met terrain when rays are blocked", () => {
    expect(flameOf().splashes).toHaveLength(0);
    expect(flameOf(30).splashes).toHaveLength(TORCH.rays);
  });

  it("should shed the look's number of flames above the stream when spraying", () => {
    const { shed, head } = flameOf();
    expect(shed).toHaveLength(FLAME_LOOK.spray.shed);
    for (const flame of shed) expect(flame.y).toBeLessThan(head.y + TORCH.length * Math.tan(HALF));
  });

  it("should keep its timings inside the juice windows when read from the look", () => {
    expect(isInJuiceWindow("squash", FLAME_LOOK.spray.growSeconds)).toBe(true);
    expect(isInJuiceWindow("effect", FLAME_LOOK.spray.releaseSeconds)).toBe(true);
    expect(isInJuiceWindow("linger", FLAME_LOOK.smokeSeconds)).toBe(true);
  });
});

describe("releasePuff", () => {
  it("should rise and shrink to nothing when the release ages", () => {
    const head = { x: 0, y: 0 };
    const early = releasePuff({ head, radius: 10 }, 0.1);
    const late = releasePuff({ head, radius: 10 }, 0.9);
    expect(late[0]!.y).toBeLessThan(early[0]!.y);
    expect(late[0]!.r).toBeLessThan(early[0]!.r);
  });
});

describe("terrain flames", () => {
  const burnSeconds = GAME_TUNABLES.fire.burnSeconds;

  it("should be tallest right after catching and smaller near burn-out when a sample burns", () => {
    const { catchSeconds } = FLAME_LOOK.terrain;
    expect(flameEnvelope(0, burnSeconds)).toBe(0);
    expect(flameEnvelope(catchSeconds, burnSeconds)).toBeGreaterThan(
      flameEnvelope(burnSeconds, burnSeconds) * 2
    );
    expect(flameEnvelope(burnSeconds, burnSeconds)).toBeGreaterThan(0);
  });

  it("should stand taller on a top edge than inside the slab when the age is equal", () => {
    const look = { size: 8, timeSeconds: 2, burnSeconds };
    const block = { x: 0, y: 0, age: 0.3, key: 5 };
    const inside = terrainTongue({ ...block, open: false }, look);
    const onTop = terrainTongue({ ...block, open: true }, look);
    expect(onTop.height).toBeGreaterThan(inside.height);
  });

  it("should outline a closed flame with its tip above its base when drawn", () => {
    const tongue = { x: 10, y: 20, width: 4, height: 12, sway: 1 };
    const points = tonguePoints(tongue);
    const ys = points.filter((_, i) => i % 2 === 1);
    expect(points.length % 2).toBe(0);
    expect(Math.min(...ys)).toBeCloseTo(tongue.y - tongue.height);
    expect(Math.max(...ys)).toBeCloseTo(tongue.y + tongue.width);
    const grown = tonguePoints(tongue, 2).filter((_, i) => i % 2 === 1);
    expect(Math.min(...grown)).toBeLessThan(Math.min(...ys));
  });
});
