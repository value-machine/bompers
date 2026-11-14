import { describe, expect, it } from "vitest";
import { computeCameraView } from "@/features/camera/services/cameraView";

describe("cameraView", () => {
  it("should center on the bounds and fit the tighter axis when framing the arena", () => {
    const view = computeCameraView({
      targets: [],
      bounds: { x: 0, y: 0, w: 1000, h: 500 },
      viewport: { width: 500, height: 500 },
      previous: null,
      padding: 0,
      dt: 1 / 60,
    });
    expect(view).toEqual({ centerX: 500, centerY: 250, zoom: 0.5 });
  });

  it("should fall back to zoom 1 when the viewport has no size yet", () => {
    const view = computeCameraView({
      targets: [],
      bounds: { x: 0, y: 0, w: 100, h: 100 },
      viewport: { width: 0, height: 0 },
      previous: null,
      padding: 10,
      dt: 0,
    });
    expect(view.zoom).toBe(1);
  });
});
