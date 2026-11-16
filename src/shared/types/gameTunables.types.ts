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
    /** Seconds an eliminated player is out of play before respawning (GDD § 6). */
    respawnDelaySeconds: number;
    /** Seconds of spawn protection after a respawn (no damage; free movement and fire). */
    spawnProtectionSeconds: number;
    /** Seconds after the round ends before a jump press restarts it (no accidental skip). */
    restartLockSeconds: number;
    /** Points (GDD § 5). Knock-off credit uses `combat.killCreditSeconds`. */
    scoring: {
      /** Eliminating another player (incl. knocking them out of bounds). */
      kill: number;
      /** Touching a point orb. */
      orb: number;
      /** Subtracted when a player is eliminated with no credited hitter (falling off alone). */
      fallPenalty: number;
    };
  };
  /** Point orbs falling from the sky onto the level's collectible points (GDD § 5). */
  collectibles: {
    firstDelaySeconds: number;
    intervalSeconds: number;
    /** No new orb while this many are in the arena. */
    maxActive: number;
    /** An orb appears this far above its point and falls onto it, world units. */
    dropHeight: number;
    /** Touch box (square), world units. */
    size: number;
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
   * ricochets off other blobs. Damage comes from `combat.hitDamage.contact` (via `applyHit`).
   * Seconds and world units; frames = seconds × `sim.stepHz`.
   */
  dive: {
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
      /** Velocity change on the shooter per shot, opposite the aim, units / s. */
      recoil: number;
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
  /**
   * Game feel (DESIGN_LANGUAGE § 6): render-only feedback on hits, explosions and tumbles. Never
   * read by the simulation. Shake is in screen px; helmet offsets in mockup units (u = R / 30).
   */
  feel: {
    /** White flash over the victim's body fill (the outline stays). */
    hitFlash: {
      /** Seconds at full strength, then a linear fade over `fadeSeconds`. */
      holdSeconds: number;
      fadeSeconds: number;
      /** Peak alpha of a front hit and of a back hit. */
      front: number;
      back: number;
      /** Peak alpha multiplier under the OS reduced-motion setting. */
      reducedMotionScale: number;
    };
    /** Camera shake kicks: each decays as (1 − t / seconds)²; live kicks sum as a root of squares. */
    shake: {
      /** Cap on the summed offset, screen px. */
      maxPx: number;
      /** Wobble rate of the offset direction. */
      frequencyHz: number;
      hit: { px: number; seconds: number };
      /** A back hit (the hard one: more damage, starts a tumble) multiplies the hit kick. */
      hardHitScale: number;
      /** Scaled by blast radius / `combat.explosion.radius` (capped at 1.5). */
      explosion: { px: number; seconds: number };
      /** Scaled by bounce speed / `fullSpeed` (capped at 1). */
      tumbleBounce: { px: number; seconds: number; fullSpeed: number };
    };
    /** Helmet (with its emblem) on a damped spring that lags behind the body. */
    helmet: {
      /** Spring stiffness (1/s²) and damping (1/s); underdamped so it wobbles. */
      stiffness: number;
      damping: number;
      /** Output caps: tilt in radians, drop in mockup units. */
      maxTilt: number;
      maxDrop: number;
      /** Velocity kicks: drop in mockup units / s (positive = sinks), tilt in rad / s. */
      landDrop: number;
      jumpDrop: number;
      wallJumpTilt: number;
      hitTilt: number;
      hitDrop: number;
    };
    /** Render-only freeze after a hard hit (the sim keeps running); 0 turns it off. */
    hitStop: { seconds: number };
  };
}
