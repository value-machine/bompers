import { JUICE_SHAKE_CAP_PX, JUICE_TIERS } from "@/shared/config/gameJuice";
import type { GameTunables } from "@/shared/types/gameTunables.types";
import { ALL_WEAPON_ITEM_IDS } from "@/shared/config/weaponItems";

export type { GameTunables };

/**
 * Game tunables — the one settings module for the game (DOC_APP_VISION § How the GDD is read:
 * "all tunables live in one settings/config module").
 *
 * Sectioned per bounded concept so parallel work edits only its own section. Units: world
 * units (px at zoom 1) and seconds. Match settings (gravity, duration, weapons) are what a lobby later
 * lets players override; pass a modified copy into `createGameState`, never mutate this object.
 */
export const DEFAULT_GAME_TUNABLES: GameTunables = {
  sim: { stepHz: 120, maxStepsPerFrame: 8 },
  // Slower tempo, same heights (jumps-and-recoil D1): every gravity-coupled vertical speed below is
  // the 2200-gravity value × √(1400 / 2200) ≈ 0.8, so apexes stay and air time grows ~25 %.
  world: { gravity: 1400, maxFallSpeed: 1120 },
  match: {
    durationSeconds: 180,
    // "Auto": every weapon the game has; the lobby or a level narrows it.
    weaponIds: ALL_WEAPON_ITEM_IDS,
    maxPlayers: 4,
    // Long enough to see the knockout's goo splat land (owner, elimination-goo lap: 1.2 → 2.0).
    respawnDelaySeconds: 2.0,
    spawnProtectionSeconds: 2.5,
    restartLockSeconds: 2,
    // A kill outweighs an orb; falling off alone costs a point (match-rules D1).
    scoring: { kill: 2, orb: 1, fallPenalty: 1 },
  },
  collectibles: {
    firstDelaySeconds: 5,
    intervalSeconds: 6,
    maxActive: 2,
    dropHeight: 600,
    size: 22,
    diveRefill: { respawnSeconds: 2.5, size: 30 },
  },
  player: {
    width: 28,
    height: 28,
    crushGapFraction: 0.2,
    runSpeed: 340,
    groundAccel: 2600,
    groundDecel: 3000,
    turnAccel: 5200,
    airAccel: 1700,
    airDecel: 700,
    // Apex at gravity 1400: 840² / 2800 ≈ 250 units — clears a 160-unit plateau with room, in 0.6 s.
    jumpSpeed: 840,
    jumpCutMultiplier: 0.45,
    coyoteTime: 0.1,
    jumpBufferTime: 0.12,
    wallSlideSpeed: 220,
    wallJumpSpeedX: 420,
    wallJumpSpeedY: 720,
    wallJumpControlLock: 0.16,
    // Slope walking (slope-walking D8): 30° up ≈ 62 % of run, 30° down ≈ 138 %. Ground of 80° and
    // more is a wall unless its top is within 12 units: then the blob pulls itself over at 25 %.
    slope: {
      uphillLoss: 0.75,
      downhillGain: 0.75,
      carryDecel: 700,
      lipAngle: (80 * Math.PI) / 180,
      // Hysteresis (slope-jump D1): a blob that walked up to the lip angle settles on contacts up
      // to ~86° (the field around its circle); it rests there instead of flipping to the air.
      restAngle: (88 * Math.PI) / 180,
      lipRise: 12,
      lipSpeed: 0.25,
      // Four body radii: hills and crater floors hold; ledges and rims (radius ≈ 14) can launch.
      stickRadius: 56,
    },
    // Defensive crouch, "sink + settle, low" (owner, crouch-sink D1): sink in 100 ms (squash
    // window), settle 350 ms (settle window), stand up 150 ms with a 3 u helmet hop. The helmet ends
    // 27 u (12 + 15) under its standing place, so the hurt box keeps 1 − 27 / 69 ≈ 0.6 of the height.
    crouch: {
      sinkSeconds: 0.1,
      settleSeconds: 0.35,
      settleHz: 2.4,
      riseSeconds: 0.15,
      hopSeconds: 0.2,
      helmetSink: 12,
      drop: 15,
      overshoot: 2,
      hop: 3,
      breathe: 0.6,
      breatheHz: 0.8,
      areaKeep: 0.94,
      hurtHeightScale: 0.6,
    },
    squash: {
      // Soft jelly landing (owner pick M2, soft-landing lap): sinks, then one wobble back.
      land: {
        sx: 1.3,
        sy: 0.72,
        sinkSeconds: [0.07, 0.11],
        seconds: 0.3,
        wobbles: 2.2,
        damping: 2.6,
      },
      landFullImpact: 1100,
      landMinAmount: 0.25,
      jump: { sx: 0.85, sy: 1.18, seconds: 0.15 },
      wallJump: { sx: 0.8, sy: 1.2, seconds: 0.12 },
      breathAmplitude: 0.03,
      breathSeconds: 1.6,
    },
  },
  bodyCollision: { restitution: 0.9, restingSpeed: 140, maxImpulse: 1100 },
  // A full-speed dive hit gives about 1000 units / s: 0.8 s out of control. A 200 shove: 0.16 s.
  // Rolling friction 200 + 1.5 × speed: a 1000 roll on the flat stops in ≈ 1.4 s (≈ 480 units);
  // on 20° it rolls down at ≈ 190 units / s. Bounces: restitution 0.3 above 300 units / s, so a
  // 250-unit fall hops once ≈ 22 units and a roll hugs slopes (was 0.6 / 160: an 89-unit hop and
  // four more; owner bug report, roll-spin-bounce, 2026-11-18).
  roll: {
    lockPerImpulse: 0.0008,
    maxLockSeconds: 1.2,
    restitution: 0.3,
    surfaceSpeedKeep: 0.85,
    minBounceSpeed: 300,
    rollingDecel: 200,
    rollingDrag: 1.5,
    steerAccel: 500,
    lockSteerScale: 0.25,
    stopSpeed: 40,
    maxSeconds: 6,
    standUpSpeed: 14,
    // Roll carry (double-jump-bash D11): a jump out of a roll keeps up to 600 sideways (run is 340)
    // and bleeds 150 / s while the stick holds that way: ≈ 610 units of jump reach vs ≈ 410.
    jumpCarryMax: 600,
    airCarryDecel: 150,
    // Spin-fire (D2): 1.25 turns / s ≈ 3.75° per 1/120 s step, under the freeze ray's 6° fan. The
    // body spins at speed / 14 (a 400 roll ≈ 4.5 turns / s), far too fast to sweep a beam at.
    sweepTurnsPerSecond: 1.25,
    // Crouch roll (owner, crouch-roll R7): 0.8 s of crouch + one direction with no fire reads as
    // "roll", shorter as aiming. Starts at 500 (run 340, jump carry cap 600, dive dash 900).
    crouchRollDelay: 0.8,
    crouchStartSpeed: 500,
  },
  dive: {
    minHitSpeed: 150,
    // A press waits up to 150 ms for the dive (a landing, a stun ending); longer waits are denied.
    fireBufferSeconds: 0.15,
    // 12 frames of crouch, then 30 frames dead straight: 0.25 s × 900 = 225 units (8 blob widths).
    windupSeconds: 0.1,
    windupSpeedScale: 0.15,
    windupGravityScale: 0,
    launchSpeed: 900,
    travelSeconds: 0.25,
    exitSpeedScale: 0.35,
    // A dive out of a fast roll launches up to 1150 (D13): 288 units of travel vs 225.
    rollCarryMax: 1150,
    recoverySeconds: 0.2,
    recoverySteerScale: 0.3,
    cooldownSeconds: 0.5,
    minTerrainHitSpeed: 120,
    // A wall bonk: a short hop back and 30 frames of stun (was 54 in the prototype).
    bonkStunSeconds: 0.25,
    bonkMinAlignment: 0.8,
    bonkRebound: 0.25,
    attackerPop: 576,
    staggerSeconds: 0.3,
    staggerSteerScale: 0.15,
  },
  // Fire on the field: 13 units / s, burn 7.5 s (owner tuning, fire-clusters D5: "way slower";
  // blast-power D6 started at 40 units / s and 1.5 s). The burning band is speed × burn ≈ 98 units deep.
  // Burn-outs are applied in batches every 0.25 s (at most that late), one effect / sound per batch.
  // A blob on fire burns 2 s: a chunk at 1 s and a second at 2 s unless crouching then (owner
  // fire-burn D10); 0.5 s grace after going out.
  fire: {
    spreadSpeed: 13,
    burnSeconds: 7.5,
    burnOutInterval: 0.25,
    blob: { firstTickSeconds: 1, burnSeconds: 2, graceSeconds: 0.5, momentSeconds: 0.6 },
  },
  // Frozen ground (ice-element D1–D8, starting values): 3600 units² of ice per second of beam,
  // so a full 3 s charge makes 10 800 units²: a round patch about 59 units in radius inside a
  // big slab, or about 270 units along a 40-unit-thick platform. Frozen ground thaws by itself
  // after 8 s; the torch thaws a patch two samples round each ray's end.
  ice: {
    freezeAreaPerSecond: 3600,
    frozenSeconds: 8,
    torchThawRadius: 8,
    // The ice block (ice-frozen-blobs D1, D8, starting values): half a second of beam freezes a
    // blob (a full second while crouching) for 2.5 s; the block brakes at 15 % of normal.
    // Freeze-ray buff (owner picked A–D): chill slows the run up to 60 % and makes the blob heavy
    // (gravity × 1.6 at full chill: a jump reaches ~62 %), holds 1.5 s before it drains, fills
    // twice as fast on slippery ground (0.25 s), and a hit on a block takes 1 chunk more.
    blob: {
      freezeSeconds: 0.5,
      crouchChillScale: 0.5,
      chillSlowMax: 0.6,
      chillHoldSeconds: 1.5,
      slipperyChillScale: 2,
      shatterDamage: 1,
      frozenSeconds: 2.5,
      cracksToBreak: 3,
      slideGrip: 0.15,
      graceSeconds: 0.5,
      momentSeconds: 0.5,
    },
  },
  combat: {
    maxHealth: 4,
    killCreditSeconds: 4,
    eventRetentionSeconds: 1,
    // Body hits from behind hurt more; explosions stay exactly 1 chunk from any side (GDD § 3).
    hitDamage: {
      contact: { front: 1, back: 2 },
      blast: { front: 1, back: 1 },
      burn: { front: 1, back: 1 },
    },
    // Crouching halves damage, rounded down: 2 → 1, 1 → 0 (feedback round 2 § 2.4, crouch D1).
    crouchDamageScale: 0.5,
    // 6 rockets, no time limit: the count stays legible without a HUD timer (combat D5).
    rocket: {
      speed: 950,
      radius: 3,
      ammo: 6,
      fireCooldown: 0.4,
      muzzleOffset: 6,
      maxLifetime: 4,
      // A kick opposite the aim on every shot: a hop when firing down, a push back when firing
      // level (strongest in the air; ground decel soaks most of it).
      recoil: 200,
      power: 50,
      craterShape: "round",
    },
    // Dodgeable (homing-missiles D2, D3): 1.4 × run speed and a turn radius of 480 / 2.6 ≈ 185
    // units (≈ 6.6 blob widths), so a late sidestep or jump makes it overshoot; fuel ends loops.
    homing: {
      speed: 480,
      ammo: 3,
      fireCooldown: 0.7,
      recoil: 120,
      maxLifetime: 3,
      lockDelaySeconds: 0.2,
      turnRate: 2.6,
      fuelSeconds: 1.6,
      lockConeDegrees: 70,
      // Same blast as the rocket.
      power: 50,
      craterShape: "round",
    },
    // Torch (blast-power D8): 3 s of fuel, a cone of ~3 blob widths (84 units) and ±18°, a light
    // push (900 u/s² ≈ a third of the ground accel), no recoil and no cooldown (it is held).
    torch: {
      ammo: 3,
      fireCooldown: 0,
      recoil: 0,
      length: 84,
      halfAngleDegrees: 18,
      rays: 7,
      push: 900,
    },
    // Freeze ray (ice-element D1): 3 s of charge like the torch, a beam of about six blob widths
    // (180 units) and a third of the torch's push. Frost cone (freeze-ray buff D): ±7° on 5 rays
    // (was ±3° on 3), about 44 units across at its end, so a dodging blob stays in it.
    freezeRay: {
      ammo: 3,
      fireCooldown: 0,
      recoil: 0,
      length: 180,
      halfAngleDegrees: 7,
      rays: 5,
      push: 300,
    },
    // Beam clash (beam-clash D1): beams of reacting elements end each other where they come
    // within one sample of touching.
    beamClash: { thickness: 4 },
    // Chosen so power 50 (the rocket) keeps the pre-power blast: push 1080, reach 64, crater 34 on
    // toughness 1 (blast-power D3, D10). Blast alone from standing: ≈ 1080² / 2800 ≈ 415 units;
    // with the recoil (1080 + 200) ≈ 585, well above a full jump (≈ 250).
    // hitPushScale: the push on hit players, lowered so a hit no longer flings a blob off the map
    // (owner, elimination-goo Change round: 1 → 0.55); the shooter's rocket jump stays full. The
    // owner keeps it there (dive-push lap: #114's cut to 0.2 was meant for the dive hit).
    blast: {
      pushPerPower: 21.6,
      reachPerPower: 1.28,
      craterPerPower: 0.68,
      minFalloff: 0.35,
      hitPushScale: 0.55,
    },
    drops: { firstDelaySeconds: 3, intervalSeconds: 7, maxActive: 2, size: 22 },
  },
  camera: {
    padding: 96,
    minViewHeight: 400,
    deadzone: 0.08,
    zoomInDeadband: 0.04,
    followRate: 6,
    zoomInRate: 2.5,
    zoomOutRate: 8,
    edgeMargin: 24,
  },
  // DESIGN_LANGUAGE § 6: hit = 3 frames of white + 3 px shake for 80 ms; explosion = 6 px for 120 ms.
  // Strengths come from the juice tiers (GAME_JUICE.md); durations stay inside its windows (tested).
  feel: {
    hitFlash: {
      holdSeconds: 0.05,
      fadeSeconds: 0.08,
      front: JUICE_TIERS.medium.flash,
      back: JUICE_TIERS.heavy.flash,
      reducedMotionScale: 0.5,
    },
    shake: {
      maxPx: JUICE_SHAKE_CAP_PX,
      frequencyHz: 30,
      hit: { px: JUICE_TIERS.medium.shakePx, seconds: 0.08 },
      // medium → heavy: a back hit shakes at the heavy tier.
      hardHitScale: JUICE_TIERS.heavy.shakePx / JUICE_TIERS.medium.shakePx,
      explosion: { px: JUICE_TIERS.heavy.shakePx, seconds: 0.12 },
      rollBounce: { px: JUICE_TIERS.medium.shakePx, seconds: 0.1, fullSpeed: 900 },
    },
    // A shot pops the barrel short and fat, then it springs back (weapon-visuals-embellish D5).
    barrelPop: { sx: 0.78, sy: 1.22, seconds: 0.2 },
    helmet: {
      stiffness: 420,
      damping: 11,
      maxTilt: 0.35,
      maxDrop: 5,
      landDrop: 70,
      jumpDrop: 45,
      wallJumpTilt: 5,
      hitTilt: 7,
      hitDrop: 40,
    },
    // Lean with the ground: 60 % of the slope, at most 30°, settling in about a fifth of a second.
    groundTilt: { share: 0.6, maxAngle: (30 * Math.PI) / 180, stiffness: 160, damping: 24 },
    feet: {
      stiffness: 260,
      damping: 13,
      stride: 0.9,
      stepLift: 0.24,
      stepSwing: 0.16,
      stepTilt: 0.5,
      fullStepSpeed: 300,
      airTilt: 0.45,
      airTiltSpeed: 900,
      landKick: 9,
      jumpKick: 6,
      maxSplay: 0.6,
      // Turns to a new surface in about a fifth of a second, with a small overshoot.
      surface: { stiffness: 300, damping: 24 },
      // 6 frames at 60 fps: longer than the sim's on / off flips, too short to see as a delay.
      contactHoldSeconds: 0.1,
    },
    // About 3 frames at 60 fps.
    hitStop: { seconds: JUICE_TIERS.heavy.hitStopSeconds },
    // Owner's pick from the knockout demo rounds (elimination-goo lap, 2026-11-16).
    knockout: {
      hardContactSpeed: 200,
      flungMaxSeconds: 0.65,
      // The land pose: the strongest squash the juice band allows.
      squash: { sx: 1.25, sy: 0.75, seconds: 0.1 },
      bounce: 0.3,
      friction: 0.25,
      droplets: {
        count: 6,
        minRadius: 0.28,
        maxRadius: 0.4,
        minSpread: 90,
        maxSpread: 200,
        startOffset: 0.45,
      },
      piecePop: 300,
      blinkSeconds: 0.5,
      splatSeconds: 4,
    },
    // Pickups (owner picks, pickup-juice D1–D3): light tier, squash and effects only.
    pickup: {
      popInSeconds: 0.15,
      settle: { sx: 1.2, sy: 0.84, seconds: 0.15 },
      fallStretch: { sx: 0.92, sy: 1.08, fullSpeed: 900 },
      ringSeconds: 0.22,
      sparkSeconds: 0.32,
      pieceSeconds: 0.45,
      dustSeconds: 0.22,
    },
  },
};
