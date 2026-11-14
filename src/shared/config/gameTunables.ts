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
  world: { gravity: 2200, maxFallSpeed: 1400 },
  match: { durationSeconds: 180, maxPlayers: 4 },
  player: {
    width: 28,
    height: 28,
    runSpeed: 340,
    groundAccel: 2600,
    groundDecel: 3000,
    turnAccel: 5200,
    airAccel: 1700,
    airDecel: 700,
    // Apex at gravity 2200: 1050² / 4400 ≈ 250 units — clears a 160-unit plateau with room.
    jumpSpeed: 1050,
    jumpCutMultiplier: 0.45,
    coyoteTime: 0.1,
    jumpBufferTime: 0.12,
    wallSlideSpeed: 220,
    wallJumpSpeedX: 420,
    wallJumpSpeedY: 900,
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
  dive: {
    frontHitDamage: 1,
    backHitDamage: 2,
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
    strikeLift: 320,
    attackerPop: 720,
    staggerSeconds: 0.3,
    staggerSteerScale: 0.15,
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
};
