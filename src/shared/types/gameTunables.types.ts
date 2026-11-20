import type { CraterShape } from "@/shared/types/craterShape.types";
import type { WeaponItemId } from "@/shared/types/weaponItems.types";

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
    /** Weapons the sky crates hold, in turn; empty = no weapon crates (level-direction D6). */
    weaponIds: readonly WeaponItemId[];
    maxPlayers: number;
    /** Seconds an eliminated player is out of play before respawning (GDD § 6). */
    respawnDelaySeconds: number;
    /** Seconds of spawn protection after a respawn (no damage; free movement and fire). */
    spawnProtectionSeconds: number;
    /** Seconds after the round ends before a jump press restarts it (no accidental skip). */
    restartLockSeconds: number;
    /** Seconds the respawn button is held before a player respawns on purpose (never-stuck). */
    selfRespawnHoldSeconds: number;
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
    /**
     * Headbutt reset (catalog item `dive-reset`): a fixed pickup on its collectible point that
     * gives a player with a spent dive the charge back mid-flight (headbutt-reset D2–D3).
     */
    diveRefill: {
      /** Seconds a taken pickup stays gone before it is back on its point. */
      respawnSeconds: number;
      /** Touch box (square), world units. */
      size: number;
    };
  };
  /** Player avatar: size, movement feel (GDD § 2) and render squash (DESIGN_LANGUAGE § 6). */
  player: {
    /** Collision box, world units. Position is the feet point (bottom-center). */
    width: number;
    height: number;
    /**
     * A moving part squeezing a blob into a gap narrower than this fraction of its width
     * crushes it; a wider gap squashes it to fit and it recovers (owner, moving-parts lap B-2).
     */
    crushGapFraction: number;
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
    /**
     * Walking on curved ground (slope-walking D1, D3, D8). The round bottom of the body rides the
     * terrain field; the run target on a slope of angle θ is runSpeed × (1 − uphillLoss · sin θ)
     * going up and runSpeed × (1 + downhillGain · sin θ) going down.
     */
    slope: {
      uphillLoss: number;
      downhillGain: number;
      /** How fast speed above the slope target bleeds off on a slope (a run-up carries), units / s². */
      carryDecel: number;
      /** Ground at least this steep (radians) is a wall, unless its top is a lip. */
      lipAngle: number;
      /**
       * Hysteresis above `lipAngle` (radians): ground up to this steep holds a blob that is
       * already standing (it rests, no walking further up); an airborne blob lands only on ground
       * gentler than `lipAngle` and slides down anything steeper.
       */
      restAngle: number;
      /** A lip: the wall's top is at most this far above the feet, world units. */
      lipRise: number;
      /** Pull-over speed at a lip, as a share of runSpeed. */
      lipSpeed: number;
      /**
       * Ground that curves more gently than this radius always holds the feet, world units. A
       * sharper edge (a ledge, a crater rim) launches a blob too fast to follow it under gravity.
       */
      stickRadius: number;
    };
    /**
     * Defensive crouch (grounded + crouch held): the blob stands still and hides under its helmet
     * (owner, crouch-sink D1). Lengths in mockup units (u = r / 30), times in seconds. The helmet
     * keeps its shape: it sinks `helmetSink` into the blob, whose top shortens to fit inside the
     * dome, while the whole blob drops `drop` and presses onto the ground; the jelly pushed out
     * bulges under the rim so the body keeps `areaKeep` of its standing area. Render only, except
     * `hurtHeightScale`, which the sim reads.
     */
    crouch: {
      /** Sink in (ease-out), then the overshoot settles over `settleSeconds` at `settleHz`. */
      sinkSeconds: number;
      settleSeconds: number;
      settleHz: number;
      /** Stand up; the helmet hops `hop` over `hopSeconds` on the way. */
      riseSeconds: number;
      hopSeconds: number;
      helmetSink: number;
      drop: number;
      overshoot: number;
      hop: number;
      /** Slow breathing of the held helmet (and the bulge with it). */
      breathe: number;
      breatheHz: number;
      areaKeep: number;
      /** Hurt box height while crouched, as a share of the standing height (crouch-sink D4). */
      hurtHeightScale: number;
    };
    /** Render-only squash and stretch (sx, sy pairs; seconds). */
    squash: {
      /**
       * Landing squash, never held still (owner, soft-landing): it sinks to (sx, sy) over
       * `sinkSeconds` (light → full impact), then springs back over `seconds` with `wobbles`
       * half-swings damped by `damping`.
       */
      land: {
        sx: number;
        sy: number;
        sinkSeconds: readonly [light: number, full: number];
        seconds: number;
        wobbles: number;
        damping: number;
      };
      /** Impact speed (units / s) that gives the full landing squash; slower = proportionally less. */
      landFullImpact: number;
      /** Squash amount of the lightest landing that squashes (1 at full impact). */
      landMinAmount: number;
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
   * Roll (player `roll.ts`): the one rolling state, from a hit (any attack) or a held dash.
   * Seconds, world units, units / s.
   */
  roll: {
    /** Lock seconds per unit of hit impulse (out of control: no jump-out, weak steering). */
    lockPerImpulse: number;
    /** Longest lock from one hit. */
    maxLockSeconds: number;
    /** Bounciness of a terrain impact (share of the speed into it that comes back). */
    restitution: number;
    /** Share of the speed along the surface kept on each bounce. */
    surfaceSpeedKeep: number;
    /** Impact speed below which a rolling blob stays on the surface instead of bouncing. */
    minBounceSpeed: number;
    /** Rolling friction on the ground: constant + per unit of speed (× the material's grip). */
    rollingDecel: number;
    rollingDrag: number;
    /** Steering acceleration toward run speed (never brakes a faster roll). */
    steerAccel: number;
    /** Share of `steerAccel` while locked. */
    lockSteerScale: number;
    /** A hit roll ends on the ground below this speed once the lock ran out. */
    stopSpeed: number;
    /** Longest roll of any kind. */
    maxSeconds: number;
    /** How fast the body turns back upright after a roll, radians / s. */
    standUpSpeed: number;
    /** Most horizontal speed a jump out of a roll keeps, units / s (roll carry, D11). */
    jumpCarryMax: number;
    /** How fast carried speed above run speed bleeds in the air while the stick holds that way. */
    airCarryDecel: number;
    /**
     * Most turns per second a held weapon sweeps round with the spin while rolling (spin-fire D2):
     * the weapon follows the body's spin up to this rate, so a beam moves less than its own
     * width per step and the sweep stays readable.
     */
    sweepTurnsPerSecond: number;
    /**
     * Crouch roll (crouch-roll R1, R7): seconds a crouched blob must hold one direction with no
     * fire before it rolls that way. Shorter, it is aiming or turning (crouch D4).
     */
    crouchRollDelay: number;
    /** Least ground speed a crouch roll starts with, units / s (a faster blob keeps its own). */
    crouchStartSpeed: number;
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
    /** Launch speed along the 16-way aim, units / s. Travel has no gravity and no steering. */
    launchSpeed: number;
    /** Longest travel; reach = launchSpeed × travelSeconds. */
    travelSeconds: number;
    /** Velocity is multiplied by this when the travel times out. */
    exitSpeedScale: number;
    /** A dive out of a roll launches at the roll's speed along the aim, up to this (D13). */
    rollCarryMax: number;
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
    /**
     * On a hit the victim is pushed like a direct rocket hit (`directHitPush`); the attacker
     * ricochets up at this speed, its dive available again at once.
     */
    attackerPop: number;
    /** Seconds a hit victim steers at `staggerSteerScale` (keeps the knockback readable). */
    staggerSeconds: number;
    staggerSteerScale: number;
  };
  /**
   * Fire on the terrain field (blast-power D5, D6): it spreads through touching fuel at
   * `spreadSpeed` (world units / s) the same every way; a lit sample burns `burnSeconds`, then is gone.
   */
  fire: {
    spreadSpeed: number;
    burnSeconds: number;
    /** Burnt-out samples are removed together every this many seconds (cost and juice batching). */
    burnOutInterval: number;
    /**
     * Blobs on fire (fire-burn b2): a blob loses a chunk (`hitDamage.burn`) `firstTickSeconds` into
     * the burn, and at `burnSeconds` goes out with a second chunk unless it is crouching then
     * (owner D10); one just put out can't catch again for `graceSeconds` (so a bump doesn't pass
     * the fire straight back). Effects show each moment for `momentSeconds`.
     */
    blob: {
      firstTickSeconds: number;
      burnSeconds: number;
      graceSeconds: number;
      momentSeconds: number;
    };
  };
  /**
   * Frozen ground (owner, ice-element D1–D8): a freeze ray on the ground makes
   * `freezeAreaPerSecond` world units² of ice per second, always on the nearest unfrozen ground
   * to where the beam touches, through touching terrain. A frozen sample behaves like ice for
   * `frozenSeconds`, then thaws by itself. The torch's flame thaws everything within
   * `torchThawRadius` world units of where a ray touches frozen ground.
   */
  ice: {
    freezeAreaPerSecond: number;
    frozenSeconds: number;
    torchThawRadius: number;
    /**
     * Frozen blobs (owner, ice-frozen-blobs D1): a blob gathers chill in a freeze ray (×
     * `crouchChillScale` while crouching) and is frozen solid at `freezeSeconds` of it, for
     * `frozenSeconds`. The block brakes at `slideGrip` of normal, breaks on jump press number
     * `cracksToBreak`, and its blob gathers no chill for `graceSeconds` after it ends. Effects
     * show each moment for `momentSeconds`.
     */
    blob: {
      freezeSeconds: number;
      crouchChillScale: number;
      frozenSeconds: number;
      cracksToBreak: number;
      slideGrip: number;
      graceSeconds: number;
      momentSeconds: number;
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
      /** Burning down (fire-burn D5); crouching does not reduce it. */
      burn: { front: number; back: number };
    };
    /** Damage multiplier while the victim crouches, rounded down (0.5: 2 → 1, 1 → 0). */
    crouchDamageScale: number;
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
      /** Blast power of its explosion, 0–100 (`combat.blast` turns it into push, reach, crater). */
      power: number;
      /** Shape its blast cuts out of terrain (`src/shared/types/craterShape.types.ts`). */
      craterShape: CraterShape;
    };
    /**
     * Homing launcher (homing-missiles D2): a slower rocket that steers toward the opponent it
     * locked at launch, with a capped turn rate and limited steering fuel so a moving player can
     * dodge it. Uses the rocket's `radius` and `muzzleOffset`; explodes with the same blast.
     */
    homing: {
      /** Flight speed, units / s (constant; steering only turns it). */
      speed: number;
      /** Missiles per pickup; the launcher is dropped when empty. */
      ammo: number;
      fireCooldown: number;
      /** Velocity change on the shooter per shot, opposite the aim, units / s. */
      recoil: number;
      /** Seconds before a missile that hit nothing explodes in the air. */
      maxLifetime: number;
      /** Seconds after launch it flies straight before it starts steering. */
      lockDelaySeconds: number;
      /** Maximum turn rate while steering, radians / s (turn radius = speed / turnRate). */
      turnRate: number;
      /** Seconds after launch steering stops; it then flies straight until it hits or expires. */
      fuelSeconds: number;
      /** Half-angle of the forward cone (degrees from the aim) in which it picks its target. */
      lockConeDegrees: number;
      /** Blast power of its explosion, 0–100. */
      power: number;
      craterShape: CraterShape;
    };
    /**
     * Torch (blast-power D8, fire-spread b1): held fire sprays a short flame cone from the helmet
     * along the aim; each of `rays` rays lights the first fuel it meets within `length`; blobs in
     * the cone are pushed along the aim. `ammo` is seconds of fuel; spraying drains it.
     */
    torch: {
      ammo: number;
      fireCooldown: number;
      recoil: number;
      /** Cone length from the helmet, world units. */
      length: number;
      /** Cone half-angle from the aim, degrees. */
      halfAngleDegrees: number;
      /** Rays across the cone (odd keeps one on the aim). */
      rays: number;
      /** Acceleration on a blob inside the cone, along the aim, units / s². */
      push: number;
    };
    /**
     * Freeze ray (owner, ice-element D1): held fire sends a narrow beam from the helmet along the
     * aim, the same ray fan as the torch with other numbers. The first terrain each ray meets
     * freezes and feeds the ice front (`ice`); blobs in the beam are pushed along the aim.
     * `ammo` is seconds of charge; holding the ray drains it.
     */
    freezeRay: {
      ammo: number;
      fireCooldown: number;
      recoil: number;
      /** Beam length from the helmet, world units. */
      length: number;
      /** Beam half-angle from the aim, degrees. */
      halfAngleDegrees: number;
      /** Rays across the beam (odd keeps one on the aim). */
      rays: number;
      /** Acceleration on a blob inside the beam, along the aim, units / s². */
      push: number;
    };
    /**
     * Where two held beams of reacting elements meet (owner, beam-clash D1, the "Steam wall";
     * the rule is `src/shared/utils/beamClash.ts`): both end there.
     */
    beamClash: {
      /** How close two beams must come to count as touching, world units. */
      thickness: number;
    };
    /**
     * One blast power P (0–100, each weapon's `power`) drives everything an explosion does, in
     * straight lines (blast-power D1, D3): players within `reachPerPower · P` of the blast
     * (nearest body point) get `pushPerPower · P` units / s at the centre, falling off linearly to
     * `minFalloff` at the edge; breakable terrain clears where distance × the material's
     * toughness ≤ `craterPerPower · P`.
     */
    blast: {
      pushPerPower: number;
      reachPerPower: number;
      craterPerPower: number;
      minFalloff: number;
      /**
       * Share of the push that players other than the shooter get (the hit knockback). The
       * shooter's own push (rocket jump) stays full (owner, elimination-goo Change round).
       */
      hitPushScale: number;
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
   * Game feel (DESIGN_LANGUAGE § 6): render-only feedback on hits, explosions and roll bounces. Never
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
      /** A back hit (the hard one: more damage, a longer roll) multiplies the hit kick. */
      hardHitScale: number;
      /** Scaled by blast reach / the rocket's reach (capped at 1.5). */
      explosion: { px: number; seconds: number };
      /** Scaled by bounce speed / `fullSpeed` (capped at 1). */
      rollBounce: { px: number; seconds: number; fullSpeed: number };
    };
    /** A shot's pop of the helmet barrel: its squash pose (inside the juice band) and recovery time. */
    barrelPop: { sx: number; sy: number; seconds: number };
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
    /**
     * Body lean on sloped ground (slope-walking D4, DESIGN_LANGUAGE § 6): the blob turns by `share`
     * of the slope under its feet, at most `maxAngle` (radians), easing on a damped spring; level in
     * the air. Render only.
     */
    groundTilt: {
      share: number;
      maxAngle: number;
      stiffness: number;
      damping: number;
    };
    /**
     * Foot motion (DESIGN_LANGUAGE § 6): run-cycle swing and toe tilt, air tilt from velocity,
     * landing / jump splay on a damped spring, and one sprung angle that turns the soles to the
     * slope or wall under the blob. Lengths in body radii R, angles in radians.
     */
    feet: {
      /** Spring stiffness (1/s²) and damping (1/s) for the splay. */
      stiffness: number;
      damping: number;
      /** Run cycle: distance per step (R), lift and forward swing of the stepping foot (R), toe tilt. */
      stride: number;
      stepLift: number;
      stepSwing: number;
      stepTilt: number;
      /** Ground speed (units / s) at which the run cycle reaches full size. */
      fullStepSpeed: number;
      /** Air tilt at `airTiltSpeed` (units / s): feet trail the horizontal speed and droop / flare with vy. */
      airTilt: number;
      airTiltSpeed: number;
      /** Splay velocity kicks (rad / s): landings spread the feet, jumps pull them in. Cap in radians. */
      landKick: number;
      jumpKick: number;
      maxSplay: number;
      /**
       * Spring of the one angle the soles face (slope, wall or air tilt): how fast the feet turn
       * when the surface changes. Stiffness 1/s², damping 1/s.
       */
      surface: { stiffness: number; damping: number };
      /**
       * Seconds the drawn blob keeps a ground or wall contact after the sim stops reporting it, so
       * a contact that flips every step (a slope as steep as a wall) doesn't flicker the feet, the
       * lean or the shadow. A jump lets go at once.
       */
      contactHoldSeconds: number;
    };
    /** Render-only freeze after a hard hit (the sim keeps running); 0 turns it off. */
    hitStop: { seconds: number };
    /**
     * Knockout (knockout feature, owner's goo pick): an eliminated blob flies with the lethal
     * hit's knockback, squashes at the first hard contact (or at once on an overkill) and bursts
     * into goo droplets that keep its momentum and splat where they touch terrain. Its helmet and
     * tube fly off as solid pieces. Speeds in world units / s, sizes as a share of the body
     * half-width R.
     */
    knockout: {
      /** A contact this fast into a surface ends the flight. */
      hardContactSpeed: number;
      /** The flight ends after this long even without a hard contact. */
      flungMaxSeconds: number;
      /** Squash before the burst: its pose (inside the juice band) and how long it holds. */
      squash: { sx: number; sy: number; seconds: number };
      /** Share of the speed a flying blob or piece keeps off a soft bounce. */
      bounce: number;
      /** Share of the sideways speed lost per floor contact. */
      friction: number;
      droplets: {
        count: number;
        /** Droplet radius range, × R. */
        minRadius: number;
        maxRadius: number;
        /** Spread speed range added to the carried momentum, in a random direction. */
        minSpread: number;
        maxSpread: number;
        /** Droplets leaving within this distance of the body's surface, × R. */
        startOffset: number;
      };
      /** Upward pop of the helmet and tube at the burst. */
      piecePop: number;
      /** Pieces blink (8 Hz) for this long before they vanish at the respawn. */
      blinkSeconds: number;
      /** Goo stains on terrain: full until the respawn, then they fade out evenly and are gone by this age. */
      splatSeconds: number;
    };
    /**
     * Pickups (point orbs, weapon crates; pickup-juice D1–D3), all light tier:
     * a pop-in where one appears, a wide squash springing back when a dropped one comes to rest, a
     * falling crate's stretch (full at `fullSpeed`, units / s), the ring every taken pickup throws,
     * an orb's mini stars, a crate's flying pieces and a landing crate's dust puffs. Seconds.
     */
    pickup: {
      popInSeconds: number;
      settle: { sx: number; sy: number; seconds: number };
      fallStretch: { sx: number; sy: number; fullSpeed: number };
      ringSeconds: number;
      sparkSeconds: number;
      pieceSeconds: number;
      dustSeconds: number;
    };
  };
}
