import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { PlayerInput, PlayerInputs } from "@/shared/types/gameInput.types";
import { EMPTY_PLAYER_INPUT } from "@/shared/utils/gameInputMapping";
import type { Rect, Vec2 } from "@/shared/types/gameGeometry.types";
import {
  groundFrictionBelow,
  rectHitsSolid,
  type TerrainGrid,
} from "@/features/arena/api/arenaApi";
import type { PlayerState } from "@/features/player/types/player.types";
import { bounceTumble, endTumble, isTumbling, tickTumble } from "@/features/player/services/tumble";

/**
 * Player controller system (sim step 2): blob movement feel (GDD § 2). Per step:
 * input (aim, facing, jump press / release) → horizontal accel → jump (ground, coyote, buffer,
 * wall) → gravity and wall-slide → axis-separated collision → contact probes (landing, wall,
 * ground below). Deterministic and DOM-free; all numbers come from `tunables.player`.
 */
export interface StepPlayersArgs {
  players: PlayerState[];
  inputs: PlayerInputs;
  terrain: TerrainGrid;
  tunables: GameTunables;
  /** Fixed step, seconds. */
  dt: number;
}

type PlayerTunables = GameTunables["player"];

/** Shadow range (DESIGN_LANGUAGE § 4): no ground within this distance → no shadow. */
const GROUND_SCAN_RANGE = 240;

export function createPlayer(slot: number, at: Vec2, tunables: GameTunables): PlayerState {
  return {
    id: `p${slot}`,
    slot,
    x: at.x,
    y: at.y,
    vx: 0,
    vy: 0,
    width: tunables.player.width,
    height: tunables.player.height,
    grounded: false,
    facing: 1,
    aimX: 1,
    aimY: 0,
    prevJump: false,
    jumpRising: false,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    wallDir: 0,
    lastWallDir: 1,
    wallCoyoteTimer: 0,
    wallJumpLockTimer: 0,
    steerScale: 1,
    gravityScale: 1,
    jumpLocked: false,
    terrainHitX: 0,
    terrainHitY: 0,
    terrainHitSpeedX: 0,
    terrainHitSpeedY: 0,
    tumbleSeconds: 0,
    tumbleBouncesLeft: 0,
    tumbleBounceCount: 0,
    lastTumbleBounceSpeed: 0,
    groundBelowY: null,
    jumpCount: 0,
    wallJumpCount: 0,
    landCount: 0,
    lastLandingSpeed: 0,
  };
}

/** Puts a player back at `at` with zero velocity and no pending jump state (respawn). */
export function placePlayer(player: PlayerState, at: Vec2): void {
  player.x = at.x;
  player.y = at.y;
  player.vx = 0;
  player.vy = 0;
  player.grounded = false;
  player.jumpRising = false;
  player.coyoteTimer = 0;
  player.jumpBufferTimer = 0;
  player.wallDir = 0;
  player.wallCoyoteTimer = 0;
  player.wallJumpLockTimer = 0;
  player.steerScale = 1;
  player.gravityScale = 1;
  player.jumpLocked = false;
  endTumble(player);
}

export const playerBody = (player: PlayerState): Rect => ({
  x: player.x - player.width / 2,
  y: player.y - player.height,
  w: player.width,
  h: player.height,
});

// ── Collision ────────────────────────────────────────────────────────────────

type Axis = "x" | "y";

/** Snaps the moving edge back to the boundary of the cell it entered. */
function snapAfterHit(player: PlayerState, hit: { axis: Axis; direction: number }, size: number) {
  const { axis, direction } = hit;
  if (axis === "x") {
    const edge = player.x + (direction * player.width) / 2;
    const snapped = direction > 0 ? Math.floor(edge / size) * size : Math.ceil(edge / size) * size;
    player.x = snapped - (direction * player.width) / 2;
    return;
  }
  player.y =
    direction > 0
      ? Math.floor(player.y / size) * size
      : Math.ceil((player.y - player.height) / size) * size + player.height;
}

/**
 * Moves along one axis in sub-steps of at most half a cell (no tunnelling) and stops at the
 * first solid cell. Returns true when it hit terrain.
 */
export function moveAxis(
  player: PlayerState,
  move: { axis: Axis; delta: number },
  terrain: TerrainGrid
) {
  const { axis, delta } = move;
  const maxStep = terrain.cellSize / 2;
  const steps = Math.ceil(Math.abs(delta) / maxStep);
  const stepDelta = steps > 0 ? delta / steps : 0;
  for (let i = 0; i < steps; i += 1) {
    player[axis] += stepDelta;
    if (rectHitsSolid(terrain, playerBody(player))) {
      snapAfterHit(player, { axis, direction: Math.sign(stepDelta) }, terrain.cellSize);
      return true;
    }
  }
  return false;
}

// ── Input ────────────────────────────────────────────────────────────────────

/** Unit aim vector from input; (facing, 0) when the stick / keys give no direction. */
function updateAim(player: PlayerState, input: PlayerInput): void {
  const length = Math.hypot(input.aimX, input.aimY);
  if (length < 1e-6) {
    player.aimX = player.facing;
    player.aimY = 0;
    return;
  }
  player.aimX = input.aimX / length;
  player.aimY = input.aimY / length;
}

/** Jump press opens the buffer; release while rising cuts the rise once (variable height). */
function readJumpButton(player: PlayerState, input: PlayerInput, p: PlayerTunables): void {
  if (input.jump && !player.prevJump) player.jumpBufferTimer = p.jumpBufferTime;
  if (!input.jump && player.jumpRising) {
    if (player.vy < 0) player.vy *= p.jumpCutMultiplier;
    player.jumpRising = false;
  }
  player.prevJump = input.jump;
}

// ── Horizontal ───────────────────────────────────────────────────────────────

/** Moves `value` toward `target` by at most `maxDelta`. */
const approach = (value: number, target: number, maxDelta: number): number =>
  value < target ? Math.min(value + maxDelta, target) : Math.max(value - maxDelta, target);

/** Acceleration toward `target`: turn boost when reversing, else ground / air accel or decel. */
function horizontalRate(player: PlayerState, target: number, p: PlayerTunables): number {
  const reversing = target !== 0 && player.vx !== 0 && Math.sign(target) !== Math.sign(player.vx);
  if (reversing) return p.turnAccel;
  if (player.grounded) return target === 0 ? p.groundDecel : p.groundAccel;
  return target === 0 ? p.airDecel : p.airAccel;
}

/**
 * Grip of the ground under the feet (the material's friction: ice ≈ 0.1, others 1); 1 in the
 * air. Scales grounded acceleration, braking and turning, so a blob on ice keeps sliding.
 */
function groundGrip(player: PlayerState, terrain: TerrainGrid): number {
  if (!player.grounded) return 1;
  const body = playerBody(player);
  return groundFrictionBelow(terrain, { x: body.x, y: player.y, w: body.w });
}

/** Steers vx toward the input speed. During a wall-jump lock the launch momentum is kept. */
function applyHorizontal(player: PlayerState, input: PlayerInput, args: StepPlayersArgs): void {
  const p = args.tunables.player;
  // steerScale 0 (an ability owns the motion): velocity and facing are left alone.
  if (player.steerScale <= 0) return;
  if (input.moveX !== 0) player.facing = input.moveX > 0 ? 1 : -1;
  if (player.wallJumpLockTimer > 0) return;
  const target = input.moveX * p.runSpeed;
  const tumbleSteer = isTumbling(player) ? args.tunables.tumble.steerScale : 1;
  const grip = groundGrip(player, args.terrain);
  const rate = horizontalRate(player, target, p) * player.steerScale * tumbleSteer * grip;
  player.vx = approach(player.vx, target, rate * args.dt);
}

// ── Jump ─────────────────────────────────────────────────────────────────────

function launch(player: PlayerState, vy: number): void {
  player.vy = vy;
  player.grounded = false;
  player.jumpRising = true;
  player.jumpBufferTimer = 0;
  player.coyoteTimer = 0;
  player.wallCoyoteTimer = 0;
}

/** Fires a buffered jump off the ground (or within coyote time), else off a wall. */
function applyJump(player: PlayerState, p: PlayerTunables): void {
  if (player.jumpBufferTimer <= 0 || player.jumpLocked || isTumbling(player)) return;
  if (player.grounded || player.coyoteTimer > 0) {
    launch(player, -p.jumpSpeed);
    player.jumpCount += 1;
    return;
  }
  if (player.wallDir !== 0 || player.wallCoyoteTimer > 0) {
    const away = player.wallDir !== 0 ? -player.wallDir : -player.lastWallDir;
    launch(player, -p.wallJumpSpeedY);
    player.vx = away * p.wallJumpSpeedX;
    player.facing = away > 0 ? 1 : -1;
    player.wallJumpLockTimer = p.wallJumpControlLock;
    player.wallJumpCount += 1;
  }
}

// ── Motion ───────────────────────────────────────────────────────────────────

/** Gravity, capped by terminal speed — or by wall-slide speed when pushing into a wall. */
function applyGravity(player: PlayerState, input: PlayerInput, args: StepPlayersArgs): void {
  const { world, player: p } = args.tunables;
  const gravity = world.gravity * player.gravityScale;
  player.vy = Math.min(player.vy + gravity * args.dt, world.maxFallSpeed);
  const pushingIntoWall = player.wallDir !== 0 && Math.sign(input.moveX) === player.wallDir;
  if (pushingIntoWall && !player.grounded) player.vy = Math.min(player.vy, p.wallSlideSpeed);
  if (player.jumpRising && player.vy >= 0) player.jumpRising = false;
}

const hitDirection = (hit: boolean, speed: number): -1 | 0 | 1 => {
  if (!hit) return 0;
  return speed > 0 ? 1 : -1;
};

/** Records which axes terrain blocked this step and how fast the blob was going. */
function reportTerrainHit(
  player: PlayerState,
  hit: { x: boolean; speedX: number; y: boolean; speedY: number }
): void {
  player.terrainHitX = hitDirection(hit.x, hit.speedX);
  player.terrainHitSpeedX = hit.x ? Math.abs(hit.speedX) : 0;
  player.terrainHitY = hitDirection(hit.y, hit.speedY);
  player.terrainHitSpeedY = hit.y ? Math.abs(hit.speedY) : 0;
}

/** Axis-separated movement against the terrain; counts a landing on the step feet touch down. */
function applyMotion(player: PlayerState, args: StepPlayersArgs): void {
  const { terrain, dt } = args;
  const speedX = player.vx;
  const hitX = moveAxis(player, { axis: "x", delta: player.vx * dt }, terrain);
  if (hitX) player.vx = 0;
  const wasGrounded = player.grounded;
  const impactSpeed = player.vy;
  const hitY = moveAxis(player, { axis: "y", delta: player.vy * dt }, terrain);
  player.grounded = hitY && impactSpeed > 0;
  if (hitY) player.vy = 0;
  reportTerrainHit(player, { x: hitX, speedX, y: hitY, speedY: impactSpeed });
  bounceTumble(player, args.tunables);
  if (player.grounded && !wasGrounded) {
    player.landCount += 1;
    player.lastLandingSpeed = impactSpeed;
  }
}

// ── Contact probes ───────────────────────────────────────────────────────────

/** Wall within one unit of the body side while airborne: -1 / 1, else 0. */
function probeWall(player: PlayerState, terrain: TerrainGrid): -1 | 0 | 1 {
  if (player.grounded) return 0;
  const body = playerBody(player);
  const strip = { y: body.y + 2, w: 1, h: body.h - 4 };
  if (rectHitsSolid(terrain, { ...strip, x: body.x + body.w })) return 1;
  if (rectHitsSolid(terrain, { ...strip, x: body.x - 1 })) return -1;
  return 0;
}

/** Top of the first solid surface under the feet within GROUND_SCAN_RANGE, or null. */
function scanGroundBelow(player: PlayerState, terrain: TerrainGrid): number | null {
  if (player.grounded) return player.y;
  const size = terrain.cellSize;
  const body = playerBody(player);
  const firstRow = Math.ceil(player.y / size) * size;
  for (let top = firstRow; top <= player.y + GROUND_SCAN_RANGE; top += size) {
    if (rectHitsSolid(terrain, { x: body.x, y: top, w: body.w, h: 1 })) return top;
  }
  return null;
}

/** Refreshes contacts and counts the coyote / buffer / lock timers down. */
function updateContacts(player: PlayerState, args: StepPlayersArgs): void {
  const { terrain, tunables, dt } = args;
  const p = tunables.player;
  player.wallDir = probeWall(player, terrain);
  if (player.wallDir !== 0) player.lastWallDir = player.wallDir;
  player.groundBelowY = scanGroundBelow(player, terrain);
  player.coyoteTimer = player.grounded ? p.coyoteTime : Math.max(0, player.coyoteTimer - dt);
  player.wallCoyoteTimer =
    player.wallDir !== 0 ? p.coyoteTime : Math.max(0, player.wallCoyoteTimer - dt);
  player.jumpBufferTimer = Math.max(0, player.jumpBufferTimer - dt);
  player.wallJumpLockTimer = Math.max(0, player.wallJumpLockTimer - dt);
  tickTumble(player, dt);
}

/** Advances every player one fixed step. Mutates the players in place. */
export function stepPlayers(args: StepPlayersArgs): void {
  const p = args.tunables.player;
  for (const player of args.players) {
    const input = args.inputs[player.slot] ?? EMPTY_PLAYER_INPUT;
    readJumpButton(player, input, p);
    applyHorizontal(player, input, args);
    updateAim(player, input);
    applyJump(player, p);
    applyGravity(player, input, args);
    applyMotion(player, args);
    updateContacts(player, args);
  }
}
