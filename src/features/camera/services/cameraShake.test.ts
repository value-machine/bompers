import { describe, expect, it } from "vitest";
import {
  cameraShakeOffset,
  cameraShakeStrength,
  createCameraShake,
  kickCameraShake,
} from "@/features/camera/services/cameraShake";

const SETTINGS = { maxPx: 12, frequencyHz: 30 };

describe("cameraShake", () => {
  it("should not move when nothing kicked it", () => {
    const shake = createCameraShake();
    const offset = cameraShakeOffset(shake, { nowMs: 500, settings: SETTINGS });
    expect(Math.abs(offset.x) + Math.abs(offset.y)).toBe(0);
  });

  it("should decay quadratically and stop when the kick's time is up", () => {
    const shake = createCameraShake();
    kickCameraShake(shake, { px: 6, seconds: 0.12, nowMs: 1000 });
    expect(cameraShakeStrength(shake, 1000, 12)).toBeCloseTo(6);
    expect(cameraShakeStrength(shake, 1060, 12)).toBeCloseTo(1.5);
    expect(cameraShakeStrength(shake, 1120, 12)).toBe(0);
  });

  it("should sum live kicks as a root of squares when several happen at once", () => {
    const shake = createCameraShake();
    kickCameraShake(shake, { px: 6, seconds: 0.12, nowMs: 0 });
    kickCameraShake(shake, { px: 6, seconds: 0.12, nowMs: 0 });
    expect(cameraShakeStrength(shake, 0, 100)).toBeCloseTo(6 * Math.SQRT2);
  });

  it("should cap the combined strength when many kicks pile up", () => {
    const shake = createCameraShake();
    for (let i = 0; i < 20; i += 1) kickCameraShake(shake, { px: 6, seconds: 1, nowMs: 0 });
    expect(cameraShakeStrength(shake, 0, 12)).toBe(12);
    const offset = cameraShakeOffset(shake, { nowMs: 10, settings: SETTINGS });
    expect(Math.abs(offset.x)).toBeLessThanOrEqual(12);
    expect(Math.abs(offset.y)).toBeLessThanOrEqual(12);
  });

  it("should replace the weakest kick only when the pool is full and the new kick is stronger", () => {
    const shake = createCameraShake(1);
    kickCameraShake(shake, { px: 6, seconds: 1, nowMs: 0 });
    kickCameraShake(shake, { px: 2, seconds: 1, nowMs: 0 });
    expect(cameraShakeStrength(shake, 0, 100)).toBeCloseTo(6);
    kickCameraShake(shake, { px: 9, seconds: 1, nowMs: 0 });
    expect(cameraShakeStrength(shake, 0, 100)).toBeCloseTo(9);
  });

  it("should reuse its offset object every frame", () => {
    const shake = createCameraShake();
    kickCameraShake(shake, { px: 3, seconds: 0.08, nowMs: 0 });
    const a = cameraShakeOffset(shake, { nowMs: 10, settings: SETTINGS });
    const b = cameraShakeOffset(shake, { nowMs: 20, settings: SETTINGS });
    expect(a).toBe(b);
  });
});
