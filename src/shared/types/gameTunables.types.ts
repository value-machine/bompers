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
  /** Unarmed attack: the dive headbutt ("bomp", GDD § 3). */
  dive: {
    /** Health chunks a hit takes per zone (front 0 / back 1 or 4 is configuration only). */
    frontHitDamage: number;
    backHitDamage: number;
    /**
     * A hit is "back" when the hit direction (attacker → victim) and the victim's facing have a
     * dot product above this (0 = any hit from the rear half, 1 = only dead-on from behind).
     */
    backZoneMinDot: number;
    /** Attacker speed toward the victim below which a touch is a bump, not a hit, units / s. */
    minHitSpeed: number;
    /** Seconds a fire press is remembered while a dive is not available yet. */
    fireBufferSeconds: number;
    /** Seconds a hit victim steers at `staggerSteerScale` (keeps the knockback readable). */
    staggerSeconds: number;
    staggerSteerScale: number;
    /** Terrain impact speed below which a touch is ignored by the dive, units / s. */
    minTerrainHitSpeed: number;
    /** Phase-1 prototype: the three candidate dives; `options[DiveState.optionIndex]` is played. */
    options: readonly DiveOptionTunables[];
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

/** One dive headbutt variant. Seconds and world units; frames = seconds × `sim.stepHz`. */
export interface DiveOptionTunables {
  id: string;
  /** Shown in the prototype overlay. */
  name: string;
  /** Snap the aim to 8 directions (true) or dive along the analog aim (false). */
  aimSnap8: boolean;
  /** Wind-up before the launch: seconds, and what happens to the current motion meanwhile. */
  windupSeconds: number;
  /** Velocity is multiplied by this once when the wind-up starts (0 = stop dead, 1 = keep). */
  windupSpeedScale: number;
  windupGravityScale: number;
  /** Launch speed along the aim, units / s. */
  launchSpeed: number;
  /** Share of the pre-launch velocity kept and added to the launch (0 = pure launch). */
  launchCarry: number;
  /** Speed cap right after launch, units / s. */
  maxSpeed: number;
  /** Travel (the part that hits): longest duration, gravity, steering, exponential drag per s. */
  travelSeconds: number;
  travelGravityScale: number;
  travelSteerScale: number;
  travelDrag: number;
  /** Seconds into the travel from which a jump press cancels the dive; null = never. */
  jumpCancelAfterSeconds: number | null;
  /** Terrain bounces a dive may take while staying active, and their bounciness. */
  terrainBounces: number;
  terrainRestitution: number;
  /** With no bounce left, landing on ground ends the travel. */
  endOnGround: boolean;
  /**
   * Head-on terrain hit with no bounce left: seconds of stun (0 = just slide / stop). "Head-on"
   * = the blocked speed is at least `bonkMinAlignment` of the dive speed.
   */
  bonkStunSeconds: number;
  bonkMinAlignment: number;
  /** Share of the impact speed the diver rebounds with on a bonk. */
  bonkRebound: number;
  /** Velocity is multiplied by this when the travel times out. */
  exitSpeedScale: number;
  /** Recovery after the travel: seconds, steering, and whether jump stays locked. */
  recoverySeconds: number;
  recoverySteerScale: number;
  recoveryLocksJump: boolean;
  /** Seconds after a dive ends before the next may start. */
  cooldownSeconds: number;
  /** On a hit, on top of the body-collision exchange: push on the victim along the hit direction. */
  strikeImpulse: number;
  /** … upward pop on the victim, units / s. */
  strikeLift: number;
  /** … share of `strikeImpulse` pushed back onto the attacker. */
  attackerRebound: number;
  /** … upward speed the attacker leaves with (0 = none). */
  attackerPop: number;
  /** A hit makes the next dive available at once (chains). */
  refreshOnHit: boolean;
}
