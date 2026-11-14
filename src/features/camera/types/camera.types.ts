import type { Rect, Vec2 } from "@/shared/types/gameGeometry.types";
import type { GameTunables } from "@/shared/types/gameTunables.types";

/** Camera tuning knobs (SSOT: the `camera` section of the game tunables). */
export type CameraSettings = GameTunables["camera"];

/** What the camera shows: the world point at the viewport center, and the zoom (1 = 1:1). */
export interface CameraView {
  centerX: number;
  centerY: number;
  zoom: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface CameraFrameArgs {
  /** Points to keep in frame (active players). */
  targets: readonly Vec2[];
  /** The arena area that should be framed when there are no targets. */
  bounds: Rect;
  viewport: Viewport;
  /** Last frame's view (smoothing), null on the first frame. */
  previous: CameraView | null;
  /** Margin kept around the framed area, world units. */
  padding: number;
  /** Seconds since the previous frame. */
  dt: number;
  /** Tuning; defaults to `DEFAULT_GAME_TUNABLES.camera` (its `padding` is overridden by `padding`). */
  settings?: CameraSettings;
}
