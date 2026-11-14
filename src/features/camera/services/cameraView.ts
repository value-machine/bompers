import type { Container } from "pixi.js";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import type { Rect, Vec2 } from "@/shared/types/gameGeometry.types";
import type {
  CameraFrameArgs,
  CameraSettings,
  CameraView,
  Viewport,
} from "@/features/camera/types/camera.types";

/**
 * Multi-target camera (GDD § 2) — pure math, run once per rendered frame (presentation, not
 * simulation: it depends on the viewport size).
 *
 * Per frame: target view (frame all targets + padding) → central deadzone → zoom limits
 * (max zoom-in by visible world height, max zoom-out = arena fit) → clamp to the level bounds →
 * exponential dt-based damping (log zoom; zoom-out faster than zoom-in) → hard containment, so
 * smoothing lag never drops a target off screen. The bounds clamp beats padding; the hard edge
 * margin beats both the clamp and the zoom-out limit: everyone stays in view.
 */
export function computeCameraView(args: CameraFrameArgs): CameraView {
  const { bounds, viewport, previous, dt, targets } = args;
  const settings: CameraSettings = {
    ...(args.settings ?? DEFAULT_GAME_TUNABLES.camera),
    padding: args.padding,
  };
  if (viewport.width <= 0 || viewport.height <= 0) {
    return previous ?? toView(rectCenter(bounds), 1);
  }
  const goal = goalView({ targets, bounds, viewport, previous, settings });
  if (!previous) return goal;
  const eased = easeView(previous, goal, { dt: Math.max(0, dt), settings });
  return containTargets(eased, { targets, viewport, margin: settings.edgeMargin });
}

/** Applies a view to the world container (everything under it is in world units). */
export function applyCameraView(world: Container, view: CameraView, viewport: Viewport): void {
  world.scale.set(view.zoom);
  world.position.set(
    viewport.width / 2 - view.centerX * view.zoom,
    viewport.height / 2 - view.centerY * view.zoom
  );
}

interface GoalArgs {
  targets: readonly Vec2[];
  bounds: Rect;
  viewport: Viewport;
  previous: CameraView | null;
  settings: CameraSettings;
}

/** The view the camera eases toward this frame. */
function goalView({ targets, bounds, viewport, previous, settings }: GoalArgs): CameraView {
  const { padding } = settings;
  const arenaZoom = fitZoom(viewport, bounds.w + padding * 2, bounds.h + padding * 2);
  const maxZoom = Math.max(arenaZoom, viewport.height / settings.minViewHeight);
  if (targets.length === 0) return toView(rectCenter(bounds), arenaZoom);

  const box = boundingBox(targets);
  const boxCenter = rectCenter(box);
  const center = previous
    ? applyDeadzone(previous, boxCenter, { viewport, fraction: settings.deadzone })
    : boxCenter;
  const limited = clamp(fitAround(center, box, { viewport, margin: padding }), arenaZoom, maxZoom);
  const clamped = clampToBounds(center, { bounds, viewport, zoom: limited });
  // The bounds clamp beats padding; the hard edge margin beats the clamp and the zoom-out limit.
  let zoom = Math.min(limited, fitAround(clamped, box, { viewport, margin: settings.edgeMargin }));
  if (previous && zoom > previous.zoom && zoom < previous.zoom * (1 + settings.zoomInDeadband)) {
    zoom = previous.zoom;
  }
  return toView(clamped, zoom);
}

/** Pans only by how far the framed centre left the central deadzone around the current centre. */
function applyDeadzone(
  current: CameraView,
  wanted: Vec2,
  opts: { viewport: Viewport; fraction: number }
): Vec2 {
  const halfW = (opts.viewport.width / current.zoom / 2) * opts.fraction;
  const halfH = (opts.viewport.height / current.zoom / 2) * opts.fraction;
  return {
    x: wanted.x - clamp(wanted.x - current.centerX, -halfW, halfW),
    y: wanted.y - clamp(wanted.y - current.centerY, -halfH, halfH),
  };
}

/** Keeps the visible area inside the level bounds on each axis where the view is smaller. */
function clampToBounds(
  center: Vec2,
  opts: { bounds: Rect; viewport: Viewport; zoom: number }
): Vec2 {
  const { bounds, viewport, zoom } = opts;
  return {
    x: clampAxis(center.x, { start: bounds.x, length: bounds.w }, viewport.width / zoom),
    y: clampAxis(center.y, { start: bounds.y, length: bounds.h }, viewport.height / zoom),
  };
}

function clampAxis(
  value: number,
  { start, length }: { start: number; length: number },
  visible: number
): number {
  if (visible >= length) return start + length / 2;
  return clamp(value, start + visible / 2, start + length - visible / 2);
}

/** Frame-rate-independent exponential damping; zoom eases in log space. */
function easeView(
  from: CameraView,
  to: CameraView,
  opts: { dt: number; settings: CameraSettings }
): CameraView {
  const { dt, settings } = opts;
  const follow = 1 - Math.exp(-settings.followRate * dt);
  const zoomRate = to.zoom < from.zoom ? settings.zoomOutRate : settings.zoomInRate;
  const zoomStep = 1 - Math.exp(-zoomRate * dt);
  return {
    centerX: from.centerX + (to.centerX - from.centerX) * follow,
    centerY: from.centerY + (to.centerY - from.centerY) * follow,
    zoom: Math.exp(Math.log(from.zoom) + (Math.log(to.zoom) - Math.log(from.zoom)) * zoomStep),
  };
}

/** Zooms out just enough that every target keeps `margin` from the screen edge. */
function containTargets(
  view: CameraView,
  opts: { targets: readonly Vec2[]; viewport: Viewport; margin: number }
): CameraView {
  if (opts.targets.length === 0) return view;
  const center = { x: view.centerX, y: view.centerY };
  const zoom = fitAround(center, boundingBox(opts.targets), opts);
  return zoom < view.zoom ? { ...view, zoom } : view;
}

/** Largest zoom that shows `box` (+ margin) around a fixed centre. */
function fitAround(center: Vec2, box: Rect, opts: { viewport: Viewport; margin: number }): number {
  const halfW = Math.max(center.x - box.x, box.x + box.w - center.x) + opts.margin;
  const halfH = Math.max(center.y - box.y, box.y + box.h - center.y) + opts.margin;
  return fitZoom(opts.viewport, halfW * 2, halfH * 2);
}

function fitZoom(viewport: Viewport, width: number, height: number): number {
  const zoom = Math.min(viewport.width / width, viewport.height / height);
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
}

function boundingBox(points: readonly Vec2[]): Rect {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

function rectCenter(rect: Rect): Vec2 {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

function toView(center: Vec2, zoom: number): CameraView {
  return { centerX: center.x, centerY: center.y, zoom };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
