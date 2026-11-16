import type { GameTunables } from "@/shared/types/gameTunables.types";

export type { GameTunables };

/**
 * Game tunables — the one settings module for the game (DOC_APP_VISION § How the GDD is read:
 * "all tunables live in one settings/config module").
 *
 * Sectioned per bounded concept so parallel work edits only its own section. Units: world
 * units (px at zoom 1) and seconds. Match settings (gravity, duration) are what a lobby later
 * lets players override; pass a modified copy into `createGameState`, never mutate this object.
 */
export const DEFAULT_GAME_TUNABLES: GameTunables = {
  sim: { stepHz: 120, maxStepsPerFrame: 8 },
  // Slower tempo, same heights (jumps-and-recoil D1): every gravity-coupled vertical speed below is
  // the 2200-gravity value × √(1400 / 2200) ≈ 0.8, so apexes stay and air time grows ~25 %.
  world: { gravity: 1400, maxFallSpeed: 1120 },
  match: {
    durationSeconds: 180,
    maxPlayers: 4,
    respawnDelaySeconds: 1.2,
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
  },
  player: {
    width: 28,
    height: 28,
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
    squash: {
      land: { sx: 1.25, sy: 0.75, seconds: 0.18 },
      landFullImpact: 1100,
      jump: { sx: 0.85, sy: 1.18, seconds: 0.15 },
      wallJump: { sx: 0.8, sy: 1.2, seconds: 0.12 },
      breathAmplitude: 0.03,
      breathSeconds: 1.6,
    },
  },
  bodyCollision: { restitution: 0.9, restingSpeed: 140, maxImpulse: 1100 },
  // A full-speed dive hit gives about 1000 units / s: hard. A glancing one stays below: light.
  tumble: {
    minImpulse: 800,
    bounces: 3,
    restitution: 0.75,
    restitutionDecay: 0.75,
    surfaceSpeedKeep: 0.6,
    minBounceSpeed: 160,
    steerScale: 0.25,
    maxSeconds: 1.4,
  },
  dive: {
    minHitSpeed: 150,
    fireBufferSeconds: 0.1,
    // 12 frames of crouch, then 30 frames dead straight: 0.25 s × 900 = 225 units (8 blob widths).
    windupSeconds: 0.1,
    windupSpeedScale: 0.15,
    windupGravityScale: 0,
    launchSpeed: 900,
    travelSeconds: 0.25,
    exitSpeedScale: 0.35,
    recoverySeconds: 0.2,
    recoverySteerScale: 0.3,
    cooldownSeconds: 0.5,
    minTerrainHitSpeed: 120,
    // A wall bonk: a short hop back and 30 frames of stun (was 54 in the prototype).
    bonkStunSeconds: 0.25,
    bonkMinAlignment: 0.8,
    bonkRebound: 0.25,
    strikeImpulse: 160,
    strikeLift: 256,
    attackerPop: 576,
    staggerSeconds: 0.3,
    staggerSteerScale: 0.15,
  },
  combat: {
    maxHealth: 4,
    killCreditSeconds: 4,
    eventRetentionSeconds: 1,
    // Body hits from behind hurt more; explosions stay exactly 1 chunk from any side (GDD § 3).
    hitDamage: { contact: { front: 1, back: 2 }, blast: { front: 1, back: 1 } },
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
    },
    // Blast alone from standing: ≈ 1080² / 2800 ≈ 415 units; with the recoil (1080 + 200) ≈ 585,
    // well above a full jump (≈ 250).
    explosion: { radius: 64, craterRadius: 34, impulse: 1080, minFalloff: 0.35 },
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
  feel: {
    hitFlash: {
      holdSeconds: 0.05,
      fadeSeconds: 0.08,
      front: 0.75,
      back: 1,
      reducedMotionScale: 0.5,
    },
    shake: {
      maxPx: 12,
      frequencyHz: 30,
      hit: { px: 3, seconds: 0.08 },
      hardHitScale: 2,
      explosion: { px: 6, seconds: 0.12 },
      tumbleBounce: { px: 3, seconds: 0.1, fullSpeed: 900 },
    },
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
      wallX: 0.85,
      wallLow: 0.15,
      wallHigh: 0.7,
      wallBlendSeconds: 0.08,
      wallJumpHoldSeconds: 0.12,
    },
    // About 3 frames at 60 fps.
    hitStop: { seconds: 0.05 },
  },
};
