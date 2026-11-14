import { describe, expect, it } from "vitest";
import { computeCameraView } from "@/features/camera/services/cameraView";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import type { CameraView } from "@/features/camera/types/camera.types";
import type { Vec2 } from "@/shared/types/gameGeometry.types";

const SETTINGS = DEFAULT_GAME_TUNABLES.camera;
const BOUNDS = { x: 0, y: 0, width: 1280, height: 720 };
const VIEWPORT = { width: 1280, height: 720 };
const ARENA_ZOOM = Math.min(
  VIEWPORT.width / (BOUNDS.width + SETTINGS.padding * 2),
  VIEWPORT.height / (BOUNDS.height + SETTINGS.padding * 2)
);
const MAX_ZOOM = VIEWPORT.height / SETTINGS.minViewHeight;

const frame = (targets: readonly Vec2[], previous: CameraView | null, dt = 1 / 60): CameraView =>
  computeCameraView({
    targets,
    bounds: BOUNDS,
    viewport: VIEWPORT,
    previous,
    padding: SETTINGS.padding,
    dt,
  });

/** Runs the camera with targets from `at(t)` for `seconds`, calling `each` after every frame. */
const simulate = (opts: {
  at: (t: number) => readonly Vec2[];
  seconds: number;
  hz?: number;
  start?: CameraView | null;
  each?: (view: CameraView, targets: readonly Vec2[]) => void;
}): CameraView => {
  const hz = opts.hz ?? 60;
  let view = opts.start ?? frame(opts.at(0), null);
  for (let i = 1; i <= Math.round(opts.seconds * hz); i++) {
    const targets = opts.at(i / hz);
    view = frame(targets, view, 1 / hz);
    opts.each?.(view, targets);
  }
  return view;
};

const onScreen = (view: CameraView, p: Vec2): boolean => {
  const halfW = VIEWPORT.width / view.zoom / 2;
  const halfH = VIEWPORT.height / view.zoom / 2;
  return Math.abs(p.x - view.centerX) <= halfW && Math.abs(p.y - view.centerY) <= halfH;
};

describe("cameraView framing", () => {
  it("should keep both players on screen every frame when they run apart from the centre", () => {
    const apart = (t: number): Vec2[] => [
      { x: 640 - 200 * t, y: 500 - 40 * t },
      { x: 640 + 200 * t, y: 500 },
    ];
    let minZoomSeen = Infinity;
    const end = simulate({
      at: apart,
      seconds: 3,
      each: (view, targets) => {
        for (const p of targets) expect(onScreen(view, p)).toBe(true);
        minZoomSeen = Math.min(minZoomSeen, view.zoom);
      },
    });
    expect(end.zoom).toBeLessThan(MAX_ZOOM);
    expect(minZoomSeen).toBeGreaterThanOrEqual(ARENA_ZOOM - 1e-9);
  });

  it("should keep every target within the padded frame after convergence", () => {
    const targets = [
      { x: 300, y: 400 },
      { x: 700, y: 520 },
      { x: 520, y: 300 },
    ];
    const view = simulate({ at: () => targets, seconds: 5 });
    for (const p of targets) {
      const padded = [
        { x: p.x - SETTINGS.padding, y: p.y - SETTINGS.padding },
        { x: p.x + SETTINGS.padding, y: p.y + SETTINGS.padding },
      ];
      for (const corner of padded) expect(onScreen(view, corner)).toBe(true);
    }
  });

  it("should not move the view when a target moves inside the central deadzone", () => {
    const start = simulate({ at: () => [{ x: 640, y: 400 }], seconds: 5 });
    const nudged = simulate({ at: () => [{ x: 645, y: 402 }], seconds: 2, start });
    expect(nudged).toEqual(start);
  });

  it("should zoom in to the comfortable single-player limit when there is one target", () => {
    const view = simulate({ at: () => [{ x: 640, y: 400 }], seconds: 5 });
    expect(view.zoom).toBeCloseTo(MAX_ZOOM, 3);
  });

  it("should stop at the arena-fit zoom-out limit when players spread across the arena", () => {
    const targets = [
      { x: 0, y: 720 },
      { x: 1280, y: 0 },
    ];
    const view = simulate({ at: () => targets, seconds: 5 });
    expect(view.zoom).toBeCloseTo(ARENA_ZOOM, 3);
  });

  it("should zoom out past the arena limit to keep players in view when they leave the arena", () => {
    const targets = [
      { x: -400, y: 500 },
      { x: 1700, y: 500 },
    ];
    const view = simulate({ at: () => targets, seconds: 5 });
    expect(view.zoom).toBeLessThan(ARENA_ZOOM);
    for (const p of targets) expect(onScreen(view, p)).toBe(true);
  });
});

describe("cameraView limits and edge cases", () => {
  it("should keep the view inside the level bounds when a lone player stands at the edge", () => {
    const view = simulate({ at: () => [{ x: 40, y: 690 }], seconds: 5 });
    const halfW = VIEWPORT.width / view.zoom / 2;
    const halfH = VIEWPORT.height / view.zoom / 2;
    expect(view.centerX - halfW).toBeGreaterThanOrEqual(-1e-6);
    expect(view.centerY + halfH).toBeLessThanOrEqual(BOUNDS.height + 1e-6);
  });

  it("should ease to the arena centre when there are no targets", () => {
    const start = simulate({ at: () => [{ x: 200, y: 600 }], seconds: 3 });
    const view = simulate({ at: () => [], seconds: 5, start });
    expect(view.centerX).toBeCloseTo(640, 2);
    expect(view.centerY).toBeCloseTo(360, 2);
    expect(view.zoom).toBeCloseTo(ARENA_ZOOM, 3);
  });

  it("should reach nearly the same view at 60 and 144 fps when targets move the same way", () => {
    const at = (t: number): Vec2[] => [
      { x: 640 - 150 * t, y: 500 },
      { x: 640 + 100 * t, y: 450 },
    ];
    const at60 = simulate({ at, seconds: 2, hz: 60 });
    const at144 = simulate({ at, seconds: 2, hz: 144 });
    expect(Math.abs(at60.centerX - at144.centerX)).toBeLessThan(3);
    expect(Math.abs(at60.centerY - at144.centerY)).toBeLessThan(3);
    expect(Math.abs(at60.zoom - at144.zoom) / at144.zoom).toBeLessThan(0.02);
  });

  it("should zoom out faster than it zooms in for the same zoom gap", () => {
    const close = [{ x: 640, y: 400 }];
    const wide = [
      { x: 40, y: 400 },
      { x: 1240, y: 400 },
    ];
    const zoomedIn = simulate({ at: () => close, seconds: 5 });
    const zoomedOut = simulate({ at: () => wide, seconds: 5 });
    const outward = frame(wide, { ...zoomedIn, zoom: zoomedIn.zoom }, 0.1);
    const inward = frame(close, zoomedOut, 0.1);
    const outShare = Math.log(zoomedIn.zoom / outward.zoom);
    const inShare = Math.log(inward.zoom / zoomedOut.zoom);
    expect(outShare).toBeGreaterThan(inShare);
  });

  it("should snap to the goal on the first frame when there is no previous view", () => {
    const view = frame([{ x: 640, y: 400 }], null);
    expect(view.zoom).toBeCloseTo(MAX_ZOOM, 6);
  });

  it("should fall back to zoom 1 when the viewport has no size yet", () => {
    const view = computeCameraView({
      targets: [],
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      viewport: { width: 0, height: 0 },
      previous: null,
      padding: 10,
      dt: 0,
    });
    expect(view.zoom).toBe(1);
  });
});
