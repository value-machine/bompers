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
  /** Camera framing. Placeholder until the camera lap. */
  camera: {
    /** World units of margin kept around the framed area. */
    padding: number;
  };
}
