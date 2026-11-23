import { describe, expect, it } from "vitest";
import type { PosedField, SampleField } from "@/shared/types/sampleFront.types";
import type { SprayParticleLook } from "@/shared/types/sprayParticles.types";
import {
  advanceSpray,
  createSprayStream,
  emitSpray,
  sprayStreamEmpty,
} from "@/shared/utils/sprayParticles";

const CELL = 4;
const dt = 1 / 60;
const LOOK: SprayParticleLook = {
  rate: 400,
  speed: 600,
  length: 180,
  halfAngleDegrees: 20,
  cap: 160,
  burstSeconds: 0.15,
};

/** A 400 × 200 world of samples, solid where `solid` says so. */
const world = (solid: (cx: number, cy: number) => boolean = () => false): PosedField[] => {
  const w = 100;
  const h = 50;
  const cells = new Uint8Array(w * h);
  for (let cy = 0; cy < h; cy += 1)
    for (let cx = 0; cx < w; cx += 1) if (solid(cx, cy)) cells[cy * w + cx] = 1;
  const field: SampleField = { cellSize: CELL, widthCells: w, heightCells: h, cells };
  return [{ field }];
};

const origin = { x: 200, y: 100 };
const headingOf = (p: { dx: number; dy: number }): number => Math.atan2(p.dy, p.dx);

describe("spray particle stream (freeze-ray-particles D1)", () => {
  it("should keep a puff's heading after the aim changes", () => {
    const stream = createSprayStream();
    const fields = world();
    emitSpray(stream, { origin, aim: { x: 1, y: 0 }, dt, look: LOOK });
    advanceSpray(stream, { fields, bodies: [], dt, now: 0, look: LOOK });
    const first = stream.puffs.map((puff) => ({ ...puff }));
    // The holder turns to aim straight up; the puffs already out fly on to the right.
    emitSpray(stream, { origin, aim: { x: 0, y: -1 }, dt, look: LOOK });
    advanceSpray(stream, { fields, bodies: [], dt, now: dt, look: LOOK });
    for (const before of first) {
      const after = stream.puffs.find((puff) => puff.dx === before.dx && puff.dy === before.dy);
      expect(after).toBeDefined();
      expect(after!.x).toBeGreaterThan(before.x);
      expect(Math.abs(headingOf(after!))).toBeLessThanOrEqual((20 * Math.PI) / 180 + 1e-9);
    }
  });

  it("should leave a spiral when the emitter spins while spraying", () => {
    const stream = createSprayStream();
    const fields = world();
    // Three quarters of a turn in 0.3 s (a fast spin out of a dive), spraying all the way.
    const steps = 18;
    for (let i = 0; i < steps; i += 1) {
      const a = (1.5 * Math.PI * i) / steps;
      emitSpray(stream, { origin, aim: { x: Math.cos(a), y: Math.sin(a) }, dt, look: LOOK });
      advanceSpray(stream, { fields, bodies: [], dt, now: i * dt, look: LOOK });
    }
    // The puffs in flight point most of the way round the holder, not one way.
    const sectors = new Set(
      stream.puffs.map((puff) => Math.floor(((headingOf(puff) + Math.PI) / (2 * Math.PI)) * 8) % 8)
    );
    expect(sectors.size).toBeGreaterThanOrEqual(6);
    // And the oldest puffs (emitted at the first aims) are furthest out: a spiral, not a ring.
    const far = stream.puffs.reduce((a, b) => (a.travelled > b.travelled ? a : b));
    const near = stream.puffs.reduce((a, b) => (a.travelled < b.travelled ? a : b));
    const turn = Math.abs(
      Math.atan2(
        Math.sin(headingOf(far) - headingOf(near)),
        Math.cos(headingOf(far) - headingOf(near))
      )
    );
    expect(far.travelled).toBeGreaterThan(near.travelled + 100);
    expect(turn).toBeGreaterThan(Math.PI / 3);
  });

  it("should stop a puff on the first solid sample and burst it there", () => {
    const stream = createSprayStream();
    // A wall from x = 260 (column 65) on.
    const fields = world((cx) => cx >= 65);
    let landed = 0;
    for (let i = 0; i < 30; i += 1) {
      emitSpray(stream, { origin, aim: { x: 1, y: 0 }, dt, look: LOOK });
      landed += advanceSpray(stream, { fields, bodies: [], dt, now: i * dt, look: LOOK }).terrain
        .length;
    }
    expect(landed).toBeGreaterThan(0);
    for (const puff of stream.puffs) expect(puff.x).toBeLessThan(260);
    expect(stream.bursts.length).toBeGreaterThan(0);
    for (const burst of stream.bursts) expect(burst.x).toBeGreaterThanOrEqual(260);
  });

  it("should report a body once per step however many puffs pass through it", () => {
    const stream = createSprayStream();
    const blob = { x: 260, y: 114, width: 28, height: 28 };
    let most = 0;
    for (let i = 0; i < 30; i += 1) {
      emitSpray(stream, { origin, aim: { x: 1, y: 0 }, dt, look: LOOK });
      const hits = advanceSpray(stream, {
        fields: world(),
        bodies: [blob],
        dt,
        now: i * dt,
        look: LOOK,
      });
      most = Math.max(most, hits.bodies.size);
      if (hits.bodies.has(blob)) expect(hits.bodies.get(blob)!.x).toBeGreaterThan(0);
    }
    expect(most).toBe(1);
  });

  it("should fly no further than its reach, keep at most its cap, and empty after release", () => {
    const stream = createSprayStream();
    const fields = world();
    for (let i = 0; i < 60; i += 1) {
      emitSpray(stream, { origin, aim: { x: 1, y: 0 }, dt, look: LOOK });
      advanceSpray(stream, { fields, bodies: [], dt, now: i * dt, look: LOOK, reach: 90 });
      expect(stream.puffs.length).toBeLessThanOrEqual(LOOK.cap);
      for (const puff of stream.puffs) expect(puff.travelled).toBeLessThanOrEqual(90);
    }
    // Let go: the puffs in flight fly out of reach and the stream empties.
    for (let i = 0; i < 30; i += 1)
      advanceSpray(stream, { fields, bodies: [], dt, now: 1 + i * dt, look: LOOK });
    expect(sprayStreamEmpty(stream)).toBe(true);
  });
});
