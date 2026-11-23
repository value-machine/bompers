import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import { inkStroke, outlineWidth } from "@/shared/utils/outlineWidth";
import type { SprayParticleStream } from "@/shared/types/sprayParticles.types";
import { advanceSpray, createSprayStream, emitSpray } from "@/shared/utils/sprayParticles";
import { ICE_LOOK, breathShape, breathStroke, frostGloss } from "@/features/ice/services/iceShapes";
import { freezePuffLook } from "@/features/ice/services/freezeRay";

const RAY = DEFAULT_GAME_TUNABLES.combat.freezeRay;
const LOOK = freezePuffLook(DEFAULT_GAME_TUNABLES);
const dt = 1 / 60;
const at = (timeSeconds: number) => ({
  timeSeconds,
  length: RAY.length,
  burstSeconds: RAY.burstSeconds,
});

/** A ray held for `seconds` at `aim` from (100, 100) in open air. */
function heldStream(seconds: number, aim = { x: 1, y: 0 }): SprayParticleStream {
  const stream = createSprayStream();
  const cells = new Uint8Array(100 * 50);
  const fields = [{ field: { cellSize: 4, widthCells: 100, heightCells: 50, cells } }];
  for (let i = 0; i < Math.round(seconds / dt); i += 1) {
    emitSpray(stream, { origin: { x: 100, y: 100 }, aim, dt, look: LOOK });
    advanceSpray(stream, { fields, bodies: [], dt, now: i * dt, look: LOOK });
  }
  return stream;
}

describe("iceShapes — the freeze ray's puffs as one cloud shape (freeze-ray-particles D1)", () => {
  const xs = (rings: { points: number[] }[]): number[] =>
    rings.flatMap((ring) => ring.points.filter((_, i) => i % 2 === 0));

  it("should draw the puffs in flight as a few closed outline rings, not separate circles", () => {
    const shape = breathShape({ slot: 0, stream: heldStream(0.5) }, at(0.5));
    expect(shape.outline.length).toBeGreaterThan(0);
    expect(shape.outline.length).toBeLessThan(10);
    expect(shape.outline.every((ring) => ring.closed)).toBe(true);
  });

  it("should draw the spray where the puffs are, out to the ray's reach and no further", () => {
    const shape = breathShape({ slot: 0, stream: heldStream(0.5) }, at(0.5));
    const outer = xs(shape.outline);
    expect(Math.max(...outer)).toBeGreaterThan(100 + RAY.length * 0.8);
    expect(Math.max(...outer)).toBeLessThan(100 + RAY.length + 20);
    // Nothing is drawn at the helmet itself: the spray shows from the emitter knob on.
    expect(Math.min(...outer)).toBeGreaterThan(100 + ICE_LOOK.breath.emitterReach / 2);
  });

  it("should keep drawing the puffs still in flight after the ray is let go", () => {
    const stream = heldStream(0.5);
    const cells = new Uint8Array(100 * 50);
    const fields = [{ field: { cellSize: 4, widthCells: 100, heightCells: 50, cells } }];
    advanceSpray(stream, { fields, bodies: [], dt: 0.1, now: 0.6, look: LOOK });
    const shape = breathShape({ slot: 0, stream }, at(0.6));
    // The tail has left the nozzle: the nearest drawn edge is now well out.
    expect(shape.outline.length).toBeGreaterThan(0);
    expect(Math.min(...xs(shape.outline))).toBeGreaterThan(100 + 40);
  });

  it("should keep the lighter inside within the outline's extent", () => {
    const shape = breathShape({ slot: 0, stream: heldStream(0.5) }, at(0.5));
    const outer = xs(shape.outline);
    const inner = xs(shape.inner);
    expect(Math.max(...inner)).toBeLessThanOrEqual(Math.max(...outer));
    expect(Math.min(...inner)).toBeGreaterThanOrEqual(Math.min(...outer));
  });

  it("should stroke its outline with the shared outline width and ink stroke at every zoom", () => {
    for (const zoom of [0.3, 1, 2.5, 6]) {
      expect(breathStroke(zoom)).toEqual(inkStroke(outlineWidth("effect", zoom).width, "ice"));
    }
  });

  it("should let snow specks fall below the puffs they come from", () => {
    const stream = heldStream(0.5);
    const shape = breathShape({ slot: 0, stream }, at(0.5));
    expect(shape.specks.length).toBeGreaterThan(0);
    // Each speck hangs under a puff in flight (a little sideways sway, then a drop).
    for (const speck of shape.specks) {
      const under = stream.puffs.some(
        (puff) => Math.abs(speck.x - puff.x) <= 2 + 1e-9 && speck.y > puff.y
      );
      expect(under).toBe(true);
    }
  });

  it("should draw nothing when no puff is in flight", () => {
    const shape = breathShape({ slot: 0, stream: createSprayStream() }, at(0));
    expect(shape.outline).toEqual([]);
    expect(shape.specks).toEqual([]);
  });
});

describe("iceShapes — frozen ground (ice-element D4)", () => {
  it("should streak only blocks with frozen ground all round when a patch is frozen", () => {
    const blocks = new Map<number, { bx: number; by: number }>();
    const stride = 100;
    for (let by = 0; by < 12; by += 1) {
      for (let bx = 0; bx < 12; bx += 1) blocks.set(by * stride + bx, { bx, by });
    }
    const gloss = frostGloss(blocks, { size: 8, stride });
    expect(gloss.length).toBeGreaterThan(0);
    for (const { a, b } of gloss) {
      for (const p of [a, b]) {
        expect(p.x).toBeGreaterThan(8);
        expect(p.x).toBeLessThan(11 * 8);
        expect(p.y).toBeGreaterThan(8);
        expect(p.y).toBeLessThan(11 * 8);
      }
    }
  });
});
