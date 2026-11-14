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
  /** Player avatar: size, movement feel (GDD § 2) and render squash (DESIGN_LANGUAGE § 6). */
  player: {
    /** Collision box, world units. Position is the feet point (bottom-center). */
    width: number;
    height: number;
    /** Top horizontal speed from input, units / s. */
    runSpeed: number;
    /** Ground acceleration toward the input speed, units / s². */
    groundAccel: number;
    /** Ground deceleration with no input, units / s². */
    groundDecel: number;
    /** Acceleration while reversing direction (ground and air), units / s². */
    turnAccel: number;
    /** Air acceleration toward the input speed (air steering), units / s². */
    airAccel: number;
    /** Air deceleration with no input, units / s². */
    airDecel: number;
    /** Take-off speed, units / s. Apex = jumpSpeed² / (2 · world.gravity), so gravity scales it. */
    jumpSpeed: number;
    /** Upward speed is multiplied by this when jump is released while rising (variable height). */
    jumpCutMultiplier: number;
    /** Seconds after leaving ground (or a wall) in which a jump still counts. */
    coyoteTime: number;
    /** Seconds a jump press is remembered before landing (or touching a wall). */
    jumpBufferTime: number;
    /** Max fall speed while sliding on a wall and pushing into it, units / s. */
    wallSlideSpeed: number;
    /** Wall-jump launch: horizontal push away from the wall and upward speed, units / s. */
    wallJumpSpeedX: number;
    wallJumpSpeedY: number;
    /** Seconds after a wall-jump in which input steering is reduced (stops instant re-cling). */
    wallJumpControlLock: number;
    /** Render-only squash and stretch (sx, sy pairs; seconds). */
    squash: {
      land: { sx: number; sy: number; seconds: number };
      /** Impact speed (units / s) that gives the full landing squash; slower = proportionally less. */
      landFullImpact: number;
      jump: { sx: number; sy: number; seconds: number };
      wallJump: { sx: number; sy: number; seconds: number };
      /** Idle breathing: amplitude on y (fraction) and loop length (seconds). */
      breathAmplitude: number;
      breathSeconds: number;
    };
  };
  /** Health, hits, rocket launcher, explosions and weapon drops (GDD § 3). */
  combat: {
    /** Health chunks per player; 0 eliminates. */
    maxHealth: number;
    /** Seconds after a hit in which falling out still credits the hitter. */
    killCreditSeconds: number;
    /** Seconds sim events stay readable in `combat.events`. */
    eventRetentionSeconds: number;
    /**
     * Health chunks a hit removes, per hit kind and per zone of the victim it lands on
     * (front = toward the victim's facing, back = behind it). Pure configuration: 0 = the hit
     * only bounces. `contact` is body hits (the unarmed dive), `blast` is explosions.
     */
    hitDamage: {
      contact: { front: number; back: number };
      blast: { front: number; back: number };
    };
    rocket: {
      /** Flight speed, units / s (straight line, no gravity). */
      speed: number;
      /** Collision radius, world units. */
      radius: number;
      /** Rockets per launcher pickup; the launcher is dropped when empty. */
      ammo: number;
      /** Seconds between shots. */
      fireCooldown: number;
      /** Spawn distance from the helmet centre along the aim. */
      muzzleOffset: number;
      /** Seconds before a rocket that hit nothing explodes in the air. */
      maxLifetime: number;
    };
    explosion: {
      /** Players within this distance of the blast (nearest body point) are hit and pushed. */
      radius: number;
      /** Destructible cells within this radius are cleared. */
      craterRadius: number;
      /** Speed added at the blast centre, units / s; falls off linearly to `minFalloff` at the edge. */
      impulse: number;
      minFalloff: number;
    };
    /** Weapon pickups dropping from the level's drop points. */
    drops: {
      firstDelaySeconds: number;
      intervalSeconds: number;
      /** No new drop while this many pickups lie in the arena. */
      maxActive: number;
      /** Square pickup box, world units. */
      size: number;
    };
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
