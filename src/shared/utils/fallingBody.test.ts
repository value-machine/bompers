import { describe, expect, it } from "vitest";
import {
  circleHitsSolid,
  stepFallingBody,
  type FallingBody,
  type SolidAt,
} from "@/shared/utils/fallingBody";

/** Floor from y 100 down; a wall from x 200 right. */
const solidAt: SolidAt = (x, y) => y >= 100 || x >= 200;

const body = (over: Partial<FallingBody>): FallingBody => ({
  x: 50,
  y: 50,
  vx: 0,
  vy: 0,
  radius: 10,
  angle: 0,
  spin: 0,
  ...over,
});

const step = (b: FallingBody, dt = 1 / 60) =>
  stepFallingBody(b, { dt, gravity: 1000, solidAt, bounce: 0.5, friction: 0.2 });

describe("fallingBody", () => {
  it("should report a hit when the rim touches solid terrain", () => {
    expect(circleHitsSolid(solidAt, { x: 50, y: 85, radius: 10 })).toBe(false);
    expect(circleHitsSolid(solidAt, { x: 50, y: 91, radius: 10 })).toBe(true);
  });

  it("should fall under gravity when nothing is below", () => {
    const b = body({});
    expect(step(b)).toBeNull();
    expect(b.vy).toBeGreaterThan(0);
    expect(b.y).toBeGreaterThan(50);
  });

  it("should bounce off a floor with an upward normal and the speed it hit with when landing", () => {
    const b = body({ y: 88, vy: 600 });
    const contact = step(b);
    expect(contact).toMatchObject({ nx: 0, ny: -1, x: 50, y: 98 });
    expect(contact!.speed).toBeCloseTo(600 + 1000 / 60);
    expect(b.vy).toBeLessThan(0);
    expect(b.y).toBe(88);
  });

  it("should report a sideways normal when it flies into a wall", () => {
    const b = body({ x: 185, vx: 900 });
    const contact = step(b);
    expect(contact).toMatchObject({ nx: -1, ny: 0, speed: 900 });
    expect(b.vx).toBe(-450);
  });

  it("should lose sideways speed and roll when sliding on a floor", () => {
    const b = body({ y: 89.9, vx: 300, vy: 10 });
    step(b);
    expect(b.vx).toBeCloseTo(240);
    expect(b.spin).toBeCloseTo(24);
  });
});
