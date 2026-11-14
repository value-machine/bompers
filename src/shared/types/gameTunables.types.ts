/** Shape of the game tunables; values and docs: `src/shared/config/gameTunables.ts`. */
export interface GameTunables {
  /** Simulation clock. */
  sim: {
    /** Fixed steps per second. */
    stepHz: number;
    /** Max fixed steps per rendered frame (avoids the spiral of death after a stall). */
    maxStepsPerFrame: number;
  };
  /** Physics of the world, settable per match or map (GDD § 7). */
  world: {
    /** Downward acceleration, world units / s². */
    gravity: number;
    /** Terminal fall speed, world units / s. */
    maxFallSpeed: number;
  };
  /** Round rules (GDD § 5, § 7). */
  match: {
    durationSeconds: number;
    maxPlayers: number;
  };
  /** Player avatar. Placeholder values until the movement lap tunes them. */
  player: {
    width: number;
    height: number;
    runSpeed: number;
    jumpSpeed: number;
  };
  /** Multi-target camera framing (GDD § 2). Rates are 1/s (exponential damping). */
  camera: {
    /** World units of margin kept around the framed targets. */
    padding: number;
    /** Max zoom-in: fewest world units visible vertically (also the single-player view). */
    minViewHeight: number;
    /** Central deadzone half-size as a fraction of the visible view; moves inside it don't pan. */
    deadzone: number;
    /** Zoom-in is ignored until it exceeds this relative step (stops breathing on small moves). */
    zoomInDeadband: number;
    /** Pan damping rate. */
    followRate: number;
    /** Zoom-in damping rate (slow, calm). */
    zoomInRate: number;
    /** Zoom-out damping rate (fast, so players never leave the screen). */
    zoomOutRate: number;
    /** Screen-edge margin in world units that every target keeps on every frame, even mid-ease. */
    edgeMargin: number;
  };
}
