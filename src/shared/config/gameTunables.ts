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
