import type { Container } from "pixi.js";
import type { CameraFrameArgs, CameraView, Viewport } from "@/features/camera/types/camera.types";

/**
 * Camera framing — pure math, run once per rendered frame (presentation, not simulation: it
 * depends on the viewport size). Placeholder: fit the arena bounds. The camera lap replaces the
 * body with multi-target framing (zoom limits, smoothing, central deadzone) and keeps the
 * signature.
 */
export function computeCameraView(args: CameraFrameArgs): CameraView {
  const { bounds, viewport, padding } = args;
  const zoom = Math.min(
    viewport.width / (bounds.w + padding * 2),
    viewport.height / (bounds.h + padding * 2)
  );
  return {
    centerX: bounds.x + bounds.w / 2,
    centerY: bounds.y + bounds.h / 2,
    zoom: Number.isFinite(zoom) && zoom > 0 ? zoom : 1,
  };
}

/** Applies a view to the world container (everything under it is in world units). */
export function applyCameraView(world: Container, view: CameraView, viewport: Viewport): void {
  world.scale.set(view.zoom);
  world.position.set(
    viewport.width / 2 - view.centerX * view.zoom,
    viewport.height / 2 - view.centerY * view.zoom
  );
}
