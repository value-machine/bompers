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
  /** Blob-vs-blob contact (equal mass, circle bodies). */
  bodyCollision: {
    /** Bounciness along the contact normal: 1 = velocities swap, 0 = both keep the average. */
    restitution: number;
    /** Closing speeds below this do not bounce (restitution 0), so resting contact stays calm. */
    restingSpeed: number;
    /** Cap on the velocity change one contact gives each blob, units / s. */
    maxImpulse: number;
  };
  /**
   * Tumble: the hurt reaction to a hard hit (any attack). The victim ricochets off floors and
   * walls for a few bounces, each weaker than the last, then recovers.
   */
  tumble: {
    /** A hit whose impulse (velocity change) is at least this starts a tumble, units / s. */
    minImpulse: number;
    /** Terrain bounces per tumble. */
    bounces: number;
    /** Bounciness of the first bounce; each later one is multiplied by `restitutionDecay`. */
    restitution: number;
    restitutionDecay: number;
    /** Share of the speed along the surface kept on each bounce (friction). */
    surfaceSpeedKeep: number;
    /** Terrain impact speed below which a tumbling blob just lands, units / s. */
    minBounceSpeed: number;
    /** Steering while tumbling (share of normal); jump is locked. */
    steerScale: number;
    /** Longest tumble; it also ends when the blob comes to rest on the ground. */
    maxSeconds: number;
  };
  /**
   * Unarmed attack: the dive headbutt ("bomp", GDD § 3). A committed straight missile that
   * ricochets off other blobs. Seconds and world units; frames = seconds × `sim.stepHz`.
   */
  dive: {
    /**
     * Health chunks a hit takes per zone (front 0 / back 1 or 4 is configuration only). Stand-in
     * for `combat.hitDamage.contact`, which replaces these two when combat is wired in.
     */
    frontHitDamage: number;
    backHitDamage: number;
    /** Attacker speed toward the victim below which a touch is a bump, not a hit, units / s. */
    minHitSpeed: number;
    /** Seconds a fire press is remembered while a dive is not available yet. */
    fireBufferSeconds: number;
    /** Wind-up (the telegraph): seconds; velocity is multiplied by the scale once at its start. */
    windupSeconds: number;
    windupSpeedScale: number;
    /** Gravity during the wind-up (0 = hang in the air). */
    windupGravityScale: number;
    /** Launch speed along the 8-way aim, units / s. Travel has no gravity and no steering. */
    launchSpeed: number;
    /** Longest travel; reach = launchSpeed × travelSeconds. */
    travelSeconds: number;
    /** Velocity is multiplied by this when the travel times out. */
    exitSpeedScale: number;
    /** Recovery after a dive that hit nobody: seconds and steering; jump stays locked. */
    recoverySeconds: number;
    recoverySteerScale: number;
    /** Seconds after the recovery before the next dive may start (none after a hit). */
    cooldownSeconds: number;
    /** Terrain impact speed below which a touch is ignored by the dive, units / s. */
    minTerrainHitSpeed: number;
    /**
     * Terrain ends the dive. Head-on (the blocked speed is at least `bonkMinAlignment` of the
     * dive speed) is a bonk: thrown back at `bonkRebound` × speed and stunned for
     * `bonkStunSeconds`. A glancing touch just ends it (normal recovery).
     */
    bonkStunSeconds: number;
    bonkMinAlignment: number;
    bonkRebound: number;
    /** On a hit, on top of the body-collision exchange: push on the victim along the hit direction. */
    strikeImpulse: number;
    /** … upward pop on the victim, units / s. */
    strikeLift: number;
    /** … upward speed the attacker ricochets off with; its dive is available again at once. */
    attackerPop: number;
    /** Seconds a hit victim steers at `staggerSteerScale` (keeps the knockback readable). */
    staggerSeconds: number;
    staggerSteerScale: number;
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
