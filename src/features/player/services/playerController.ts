import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { PlayerInput, PlayerInputs } from "@/shared/types/gameInput.types";
import { EMPTY_PLAYER_INPUT } from "@/shared/utils/gameInputMapping";
import type { Rect, Vec2 } from "@/shared/types/gameGeometry.types";
import {
  circleHitsSolid,
  fieldNormalAt,
  groundFrictionBelow,
  rectHitsSolid,
  settleCircle,
  type TerrainGrid,
} from "@/features/arena/api/arenaApi";
import type { PlayerState } from "@/features/player/types/player.types";
import {
  bounceRoll,
  endRoll,
  isRolling,
  isRollLocked,
  releaseRoll,
  resetRoll,
  tickRoll,
} from "@/features/player/services/roll";

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
    crouchHeight: tunables.player.height * tunables.player.crouch.hurtHeightScale,
    grounded: false,
    facing: 1,
    aimX: 1,
    aimY: 0,
    aimHeld: false,
    prevJump: false,
    jumpRising: false,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    jumpPressCounted: false,
    airCarrySpeed: 0,
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
    rollSource: null,
    rollHoldButton: null,
    rollLockSeconds: 0,
    rollSeconds: 0,
    rollAngle: 0,
    rollSpin: 0,
    weaponSweep: 0,
    dashRollCount: 0,
    rollRestCount: 0,
    rollBounceCount: 0,
    lastRollBounceSpeed: 0,
    crouching: false,
    crouchCount: 0,
    groundBelowY: null,
    jumpCount: 0,
    airJumpPressCount: 0,
    wallJumpCount: 0,
    landCount: 0,
    airSeconds: 0,
    lastLandingSpeed: 0,
    groundAngle: 0,
    groundVelocity: { x: 0, y: 0 },
    squeeze: null,
  };
}

/** Puts a player back at `at` with zero velocity and no pending jump state (respawn). */
export function placePlayer(player: PlayerState, at: Vec2): void {
  player.x = at.x;
  player.y = at.y;
  player.vx = 0;
  player.vy = 0;
  player.grounded = false;
  player.groundAngle = 0;
  player.squeeze = null;
  player.jumpRising = false;
  player.coyoteTimer = 0;
  player.jumpBufferTimer = 0;
  player.wallDir = 0;
  player.wallCoyoteTimer = 0;
  player.wallJumpLockTimer = 0;
  resetStance(player);
  resetRoll(player);
}

/** Plain movement again: no ability modifiers, no crouch, no carried speed. */
function resetStance(player: PlayerState): void {
  player.airCarrySpeed = 0;
  player.groundVelocity = { x: 0, y: 0 };
  player.steerScale = 1;
  player.gravityScale = 1;
  player.jumpLocked = false;
  player.crouching = false;
}

export const playerBody = (player: PlayerState): Rect => ({
  x: player.x - player.width / 2,
  y: player.y - player.height,
  w: player.width,
  h: player.height,
});

/** Height hits see: the full height, or the lower `crouchHeight` while crouched (crouch-sink D4). */
export const hurtHeight = (player: PlayerState): number =>
  player.crouching ? player.crouchHeight : player.height;

/**
 * What weapons, blasts and beams hit: the body box from the feet up `hurtHeight`. Terrain and
 * blob-to-blob collision keep the full `playerBody`.
 */
export const hurtBox = (player: PlayerState): Rect => {
  const h = hurtHeight(player);
  return { ...playerBody(player), y: player.y - h, h };
};

// ── Collision ────────────────────────────────────────────────────────────────

type Axis = "x" | "y";

/**
 * Against terrain the body is a round bottom on the distance field (radius width / 2, the shape
 * that rides slopes) under a head box on the cells, inset half a sample at the sides and one
 * sample above the circle's center so cell steps never catch on a slope (slope-walking D7, A4).
 */
const bodyRadius = (player: PlayerState): number =>
  (player.width / 2) * (player.squeeze?.scale ?? 1);
/** The circle sits on the feet point; squeezed, it shrinks and stays on the feet (moving parts). */
const bodyCenter = (player: PlayerState): Vec2 => ({
  x: player.x,
  y: player.y - (player.squeeze ? bodyRadius(player) : player.height / 2),
});

function headBox(player: PlayerState, terrain: TerrainGrid): Rect {
  // Squeezed by a moving part, the blob is only its shrunken circle (no head box to catch).
  if (player.squeeze) {
    const center = bodyCenter(player);
    return { x: center.x - 0.5, y: center.y - 0.5, w: 1, h: 1 };
  }
  const side = terrain.cellSize / 2;
  return {
    x: player.x - player.width / 2 + side,
    y: player.y - player.height,
    w: player.width - side * 2,
    h: Math.max(0, player.height / 2 - terrain.cellSize),
  };
}

function bodyHitsSolid(player: PlayerState, terrain: TerrainGrid): boolean {
  if (circleHitsSolid(terrain, { center: bodyCenter(player), radius: bodyRadius(player) })) {
    return true;
  }
  return rectHitsSolid(terrain, headBox(player, terrain));
}

const CONTACT_HALVINGS = 14;
/** Contact positions round to this grid when that stays free, so flat contacts are exact. */
const CONTACT_GRID = 64;

/** Backs off from a hit to the free position closest to contact (bisection), on one axis. */
function backOff(player: PlayerState, move: { axis: Axis; from: number }, terrain: TerrainGrid) {
  const { axis } = move;
  let free = move.from;
  let hit = player[axis];
  for (let i = 0; i < CONTACT_HALVINGS; i += 1) {
    player[axis] = (free + hit) / 2;
    if (bodyHitsSolid(player, terrain)) hit = player[axis];
    else free = player[axis];
  }
  player[axis] = Math.round(free * CONTACT_GRID) / CONTACT_GRID;
  if (bodyHitsSolid(player, terrain)) player[axis] = free;
}

/**
 * A sideways move that touches ground no steeper than the lip angle lifts onto it instead of
 * stopping (slope-walking A6): the round bottom slides up the slope, no wall hit.
 */
function slideUpSlope(player: PlayerState, dx: number, args: ContactArgs): boolean {
  const rise = Math.abs(dx) * Math.tan(args.slope.lipAngle);
  const settled = settleCircle(
    args.terrain,
    { center: bodyCenter(player), radius: bodyRadius(player) },
    { rise, drop: 0 }
  );
  if (settled.kind !== "ground") return false;
  const startY = player.y;
  player.y = settled.centerY + player.height / 2;
  if (!rectHitsSolid(args.terrain, headBox(player, args.terrain))) return true;
  player.y = startY;
  return false;
}

/** Gap kept from the slope when a falling body steps off ground too steep to land on. */
const STEEP_SLIDE_CLEARANCE = 0.05;

/**
 * A fall that touches ground steeper than the lip angle slides down it instead of landing
 * (slope-jump D1): the body steps sideways off the slope by what the drop needs on that slope.
 * Blocked (a corner, a pit), it lands as before.
 */
function slideDownSteep(player: PlayerState, dy: number, args: ContactArgs): boolean {
  const normal = fieldNormalAt(args.terrain, bodyCenter(player));
  const steep = -normal.y < Math.cos(args.slope.lipAngle) && Math.abs(normal.x) > 1e-6;
  if (!steep) return false;
  const startX = player.x;
  const off = Math.abs((dy * normal.y) / normal.x) + STEEP_SLIDE_CLEARANCE;
  player.x += Math.sign(normal.x) * off;
  if (!bodyHitsSolid(player, args.terrain)) return true;
  player.x = startX;
  return false;
}

/** What a terrain contact move needs: the grid and the slope limits (to slide up slopes). */
export interface ContactArgs {
  terrain: TerrainGrid;
  slope: PlayerTunables["slope"];
}

/**
 * Moves along one axis in sub-steps of at most half a cell (no tunnelling) and stops in contact
 * with the first terrain it meets; sideways, floor-like ground is slid up instead, and falling,
 * ground too steep to land on is slid down. Returns true when it hit terrain.
 */
export function moveAxis(
  player: PlayerState,
  move: { axis: Axis; delta: number; slide?: boolean },
  args: ContactArgs
): boolean {
  const { axis, delta } = move;
  const maxStep = args.terrain.cellSize / 2;
  const steps = Math.ceil(Math.abs(delta) / maxStep);
  const stepDelta = steps > 0 ? delta / steps : 0;
  for (let i = 0; i < steps; i += 1) {
    const from = player[axis];
    player[axis] += stepDelta;
    if (!bodyHitsSolid(player, args.terrain)) continue;
    if (move.slide !== false && slidesAlong(player, { axis, delta: stepDelta }, args)) continue;
    backOff(player, { axis, from }, args.terrain);
    return true;
  }
  return false;
}

/** Sideways up floor-like ground, or falling down ground too steep to land on. */
function slidesAlong(
  player: PlayerState,
  step: { axis: Axis; delta: number },
  args: ContactArgs
): boolean {
  if (step.axis === "x") return slideUpSlope(player, step.delta, args);
  return step.delta > 0 && slideDownSteep(player, step.delta, args);
}

// ── Input ────────────────────────────────────────────────────────────────────

/** Unit aim vector from input; (facing, 0) when the stick / keys give no direction. */
function updateAim(player: PlayerState, input: PlayerInput): void {
  const length = Math.hypot(input.aimX, input.aimY);
  player.aimHeld = length >= 1e-6;
  if (!player.aimHeld) {
    player.aimX = player.facing;
    player.aimY = 0;
    return;
  }
  player.aimX = input.aimX / length;
  player.aimY = input.aimY / length;
}

/** Jump press opens the buffer; release while rising cuts the rise once (variable height). */
function readJumpButton(player: PlayerState, input: PlayerInput, p: PlayerTunables): void {
  if (input.jump && !player.prevJump) {
    player.jumpBufferTimer = p.jumpBufferTime;
    player.jumpPressCounted = false;
  }
  if (!input.jump && player.jumpRising) {
    if (player.vy < 0) player.vy *= p.jumpCutMultiplier;
    player.jumpRising = false;
  }
  player.prevJump = input.jump;
}

/**
 * Crouch holds while grounded with crouch held, unless rolling or an ability owns the
 * steering (the dive). Decided from last step's contacts, before any movement this step.
 */
function updateCrouch(player: PlayerState, input: PlayerInput): void {
  const crouching = input.crouch && player.grounded && !isRolling(player) && player.steerScale >= 1;
  if (crouching && !player.crouching) player.crouchCount += 1;
  player.crouching = crouching;
}

// ── Horizontal ───────────────────────────────────────────────────────────────

/** Moves `value` toward `target` by at most `maxDelta`. */
const approach = (value: number, target: number, maxDelta: number): number =>
  value < target ? Math.min(value + maxDelta, target) : Math.max(value - maxDelta, target);

/** Air acceleration toward `target`: turn boost when reversing, else air accel or decel. */
function airRate(player: PlayerState, target: number, p: PlayerTunables): number {
  const reversing = target !== 0 && player.vx !== 0 && Math.sign(target) !== Math.sign(player.vx);
  if (reversing) return p.turnAccel;
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

/**
 * Steers toward the input speed: along the ground while grounded (slope target), else vx in
 * the air. During a wall-jump lock the launch momentum is kept.
 */
function applyHorizontal(player: PlayerState, input: PlayerInput, args: StepPlayersArgs): void {
  // steerScale 0 (an ability owns the motion): velocity and facing are left alone.
  if (player.steerScale <= 0) return;
  if (input.moveX !== 0) player.facing = input.moveX > 0 ? 1 : -1;
  if (player.wallJumpLockTimer > 0) return;
  leaveGroundIfPushedOff(player, args.terrain);
  if (isRolling(player)) {
    player.airCarrySpeed = 0;
    steerRoll(player, input, args);
    return;
  }
  const scale = player.steerScale * groundGrip(player, args.terrain);
  if (player.grounded) {
    steerOnGround(player, input, { args, scale });
    return;
  }
  steerAir(player, input, { args, scale });
}

/**
 * Air steering toward the input speed. Roll carry (double-jump-bash D11): speed a jump carried
 * out of a roll, above run speed, bleeds slowly while the stick holds along it; let go or reverse
 * and the carry ends, so steering is as before. Speed above the carry (a blast) steers as always.
 */
function steerAir(
  player: PlayerState,
  input: PlayerInput,
  ctx: { args: StepPlayersArgs; scale: number }
) {
  const { player: p, roll } = ctx.args.tunables;
  const speed = Math.abs(player.vx);
  const holding = input.moveX !== 0 && Math.sign(input.moveX) === Math.sign(player.vx);
  const carried = holding && speed > p.runSpeed && speed <= player.airCarrySpeed + 1e-6;
  if (carried) {
    const kept = Math.max(p.runSpeed, speed - roll.airCarryDecel * ctx.scale * ctx.args.dt);
    player.vx = Math.sign(player.vx) * kept;
    player.airCarrySpeed = kept;
    return;
  }
  player.airCarrySpeed = 0;
  // A crouching blob turns but does not walk: it brakes to a stop.
  const target = player.crouching ? 0 : input.moveX * p.runSpeed;
  player.vx = approach(player.vx, target, airRate(player, target, p) * ctx.scale * ctx.args.dt);
}

// ── Ground (slope walking) ───────────────────────────────────────────────────

/** The ground under a grounded body: outward normal and the tangent toward +x. */
interface GroundFrame {
  normal: Vec2;
  tangent: Vec2;
}

function groundFrame(player: PlayerState, terrain: TerrainGrid): GroundFrame {
  const normal = fieldNormalAt(terrain, bodyCenter(player));
  return { normal, tangent: { x: -normal.y, y: normal.x } };
}

/** Speed along the ground: the world velocity on the tangent (slope-walking A2). */
const groundSpeed = (player: PlayerState, frame: GroundFrame): number =>
  player.vx * frame.tangent.x + player.vy * frame.tangent.y;

/** Slopes gentler than this count as flat: today's rates apply unchanged (D8). */
const FLAT_SLOPE_SIN = Math.sin((5 * Math.PI) / 180);

/** A lip (D3): the body fits `lipRise` higher and a little further on. */
function lipIsFree(player: PlayerState, dir: number, args: StepPlayersArgs): boolean {
  const { x, y } = player;
  player.x += dir * 2;
  player.y -= args.tunables.player.slope.lipRise;
  const free = !bodyHitsSolid(player, args.terrain);
  player.x = x;
  player.y = y;
  return free;
}

/** Signed run target along the ground for this input and slope (D8), or the lip pull (D3). */
function slopeTarget(
  player: PlayerState,
  input: PlayerInput,
  ctx: { args: StepPlayersArgs; frame: GroundFrame }
): number {
  const p = ctx.args.tunables.player;
  if (player.crouching || input.moveX === 0) return 0;
  const dir = input.moveX > 0 ? 1 : -1;
  // Sine of the slope in the travel direction: + uphill.
  const rise = -ctx.frame.tangent.y * dir;
  if (rise >= Math.sin(p.slope.lipAngle)) {
    return lipIsFree(player, dir, ctx.args) ? dir * p.slope.lipSpeed * p.runSpeed : 0;
  }
  const factor = rise > 0 ? 1 - p.slope.uphillLoss * rise : 1 - p.slope.downhillGain * rise;
  return input.moveX * p.runSpeed * factor;
}

/**
 * Acceleration toward the ground target: on the flat, today's accel / decel / turn rates (feel
 * kept). On a slope, speed above the target bleeds off at `carryDecel` (a run-up carries) and
 * speed past runSpeed builds downhill at gravity × sin θ (D8).
 */
function groundRate(
  speed: number,
  target: number,
  ctx: { p: PlayerTunables; gravity: number; slopeSin: number }
): number {
  const { p } = ctx;
  if (target === 0) return p.groundDecel;
  if (speed !== 0 && Math.sign(target) !== Math.sign(speed)) return p.turnAccel;
  const sloped = ctx.slopeSin > FLAT_SLOPE_SIN;
  if (Math.abs(speed) > Math.abs(target)) return sloped ? p.slope.carryDecel : p.groundAccel;
  if (sloped && Math.abs(speed) >= p.runSpeed) return ctx.gravity * ctx.slopeSin;
  return p.groundAccel;
}

function steerOnGround(
  player: PlayerState,
  input: PlayerInput,
  ctx: { args: StepPlayersArgs; scale: number }
): void {
  const { args } = ctx;
  const frame = groundFrame(player, args.terrain);
  const speed = groundSpeed(player, frame);
  const target = slopeTarget(player, input, { args, frame });
  const rate = groundRate(speed, target, {
    p: args.tunables.player,
    gravity: args.tunables.world.gravity * player.gravityScale,
    slopeSin: Math.abs(frame.tangent.y),
  });
  const next = approach(speed, target, rate * ctx.scale * args.dt);
  player.vx = next * frame.tangent.x;
  player.vy = next * frame.tangent.y;
}

// ── Roll (ball physics) ──────────────────────────────────────────────────────

/** Input steering of a roll: pushes toward run speed, never brakes a faster roll. */
function rollSteer(speed: number, input: PlayerInput, ctx: { args: StepPlayersArgs; dt: number }) {
  const { roll, player: p } = ctx.args.tunables;
  if (input.moveX === 0 || speed * Math.sign(input.moveX) >= p.runSpeed) return speed;
  return speed + input.moveX * roll.steerAccel * ctx.dt;
}

/**
 * A rolling blob is a ball (shared-roll D2): on the ground gravity pulls it along the slope
 * (down a hill it speeds up), rolling friction slows it (× the ground's grip, so ice keeps it
 * going) and the input only nudges it; in the air it flies, nudged the same way.
 */
function steerRoll(player: PlayerState, input: PlayerInput, args: StepPlayersArgs): void {
  const { roll, world } = args.tunables;
  const lockScale = isRollLocked(player) ? roll.lockSteerScale : 1;
  const steer = { args, dt: args.dt * player.steerScale * lockScale };
  if (!player.grounded) {
    player.vx = rollSteer(player.vx, input, steer);
    return;
  }
  const frame = groundFrame(player, args.terrain);
  const gravity = world.gravity * player.gravityScale;
  let speed = groundSpeed(player, frame) + gravity * frame.tangent.y * args.dt;
  const friction = (roll.rollingDecel + roll.rollingDrag * Math.abs(speed)) * args.dt;
  speed = approach(speed, 0, friction * groundGrip(player, args.terrain));
  speed = rollSteer(speed, input, steer);
  player.vx = speed * frame.tangent.x;
  player.vy = speed * frame.tangent.y;
}

// ── Jump ─────────────────────────────────────────────────────────────────────

/**
 * Take-off: the kick replaces the vertical speed and adds to the sideways speed, which is kept
 * (a run carries into the jump).
 */
function launch(player: PlayerState, kick: Vec2, tunables: GameTunables): void {
  // Roll carry (double-jump-bash D11): a jump out of a roll keeps its sideways speed, capped.
  const { jumpCarryMax } = tunables.roll;
  const rolling = isRolling(player);
  const carry = rolling ? Math.min(Math.abs(player.vx), jumpCarryMax) : 0;
  player.vx = (carry > 0 ? Math.sign(player.vx) * carry : player.vx) + kick.x;
  player.airCarrySpeed = rolling ? Math.min(Math.abs(player.vx), jumpCarryMax) : 0;
  // A jump is the way out of a roll once the lock ran out (shared-roll D6).
  endRoll(player);
  player.vy = kick.y;
  player.grounded = false;
  player.crouching = false;
  player.jumpRising = true;
  player.jumpBufferTimer = 0;
  player.coyoteTimer = 0;
  player.wallCoyoteTimer = 0;
}

/**
 * Ground close enough under a falling or rising blob that a press is meant as the landing jump
 * (jump buffer), not an air press: what the blob covers in the buffer time with gravity, plus
 * one step because `groundBelowY` is from the previous step (double-jump-bash D2, A3).
 */
function isLandingNear(player: PlayerState, args: StepPlayersArgs): boolean {
  if (player.groundBelowY === null) return false;
  const t = args.tunables.player.jumpBufferTime;
  const gravity = args.tunables.world.gravity * player.gravityScale;
  const reach =
    Math.max(player.vy, 0) * t + 0.5 * gravity * t * t + Math.abs(player.vy) * args.dt + 4;
  return player.groundBelowY - player.y <= reach;
}

/**
 * A buffered press that is no ground, coyote or wall jump and has no landing near is an air
 * press: counted once (the dive reads it), while the buffer stays, so a wall or landing jump
 * still fires if the dive does not start (double-jump-bash D2, D3, A4).
 */
function countAirPress(player: PlayerState, args: StepPlayersArgs): void {
  if (player.jumpPressCounted || isLandingNear(player, args)) return;
  player.jumpPressCounted = true;
  player.airJumpPressCount += 1;
}

/** Jumps off the wall being touched (or the last one, within wall coyote time). */
function wallJump(player: PlayerState, tunables: GameTunables): void {
  const p = tunables.player;
  const away = player.wallDir !== 0 ? -player.wallDir : -player.lastWallDir;
  launch(player, { x: 0, y: -p.wallJumpSpeedY }, tunables);
  player.vx = away * p.wallJumpSpeedX;
  player.airCarrySpeed = 0;
  player.facing = away > 0 ? 1 : -1;
  player.wallJumpLockTimer = p.wallJumpControlLock;
  player.wallJumpCount += 1;
}

/**
 * Which way a ground jump goes (slope-jump D2): along the normal of the ground under the feet,
 * tilted from straight up at most as far as a wall-jump launches (so the steepest slopes jump
 * like a wall). Flat ground (under 5°) and a coyote jump, with no ground left, go straight up.
 */
function jumpDirection(player: PlayerState, args: StepPlayersArgs): Vec2 {
  if (!player.grounded) return { x: 0, y: -1 };
  const p = args.tunables.player;
  const { normal } = groundFrame(player, args.terrain);
  const maxTilt = Math.atan2(p.wallJumpSpeedX, p.wallJumpSpeedY);
  const tilt = Math.max(-maxTilt, Math.min(maxTilt, Math.atan2(normal.x, -normal.y)));
  if (Math.abs(Math.sin(tilt)) < FLAT_SLOPE_SIN) return { x: 0, y: -1 };
  return { x: Math.sin(tilt), y: -Math.cos(tilt) };
}

/** Fires a buffered jump off the ground (or within coyote time), else off a wall. */
function applyJump(player: PlayerState, args: StepPlayersArgs): void {
  const p = args.tunables.player;
  if (player.jumpBufferTimer <= 0 || player.jumpLocked || isRollLocked(player)) return;
  if (player.grounded || player.coyoteTimer > 0) {
    const dir = jumpDirection(player, args);
    launch(player, { x: dir.x * p.jumpSpeed, y: dir.y * p.jumpSpeed }, args.tunables);
    player.jumpCount += 1;
    return;
  }
  if (player.wallDir !== 0 || player.wallCoyoteTimer > 0) {
    wallJump(player, args.tunables);
    return;
  }
  countAirPress(player, args);
}

// ── Motion ───────────────────────────────────────────────────────────────────

/** Gravity, capped by terminal speed — or by wall-slide speed when pushing into a wall. */
function applyGravity(player: PlayerState, input: PlayerInput, args: StepPlayersArgs): void {
  // On the ground the slope rule carries gravity's share (D8); the ground holds the rest.
  if (player.grounded) return;
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

const contactArgs = (args: StepPlayersArgs): ContactArgs => ({
  terrain: args.terrain,
  slope: args.tunables.player.slope,
});

/** Where the body would rest at x on the ground below or above (within `reach`), head free. */
function restingY(player: PlayerState, at: { x: number; reach: number }, terrain: TerrainGrid) {
  const center = { x: at.x, y: bodyCenter(player).y };
  const settled = settleCircle(
    terrain,
    { center, radius: bodyRadius(player) },
    {
      rise: at.reach,
      drop: at.reach,
    }
  );
  if (settled.kind !== "ground") return settled.kind;
  const y = settled.centerY + player.height / 2;
  const head = headBox({ ...player, x: at.x, y }, terrain);
  return rectHitsSolid(terrain, head) ? "blocked" : y;
}

/**
 * Leaves the ground at a convex edge when following it would take more than gravity: speed² ×
 * curvature above the share of gravity pressing into the ground (slope-walking A1). A fast blob
 * launches off a ledge or crest; a slow one rolls over it.
 */
function launchesOff(
  player: PlayerState,
  turn: { from: Vec2; dir: number; speed: number; distance: number },
  args: StepPlayersArgs
): boolean {
  // Still climbing (over a crater rim): the feet stay down.
  if (turn.from.y * turn.dir < 0) return false;
  const to = groundFrame(player, args.terrain).tangent;
  // Positive when the ground turns downward in the travel direction.
  const downTurn = (turn.from.x * to.y - turn.from.y * to.x) * turn.dir;
  if (downTurn <= 0 || turn.distance < 1e-6) return false;
  const curvature = Math.asin(Math.min(1, downTurn)) / turn.distance;
  // Gentle curves (hills, crater floors) always hold the feet: only an edge can launch.
  if (curvature < 1 / args.tunables.player.slope.stickRadius) return false;
  const pressing = args.tunables.world.gravity * player.gravityScale * Math.max(0, to.x);
  return turn.speed * turn.speed * curvature > pressing;
}

/** `rest`: standing still at the slope limit (no move, no wall hit). */
type GroundStep = "moved" | "air" | "wall" | "lip" | "rest";

/** Walks against a wall: the farthest fraction of `dx` the body still rests at (bisection). */
function walkToWall(
  player: PlayerState,
  step: { dx: number; reach: number },
  terrain: TerrainGrid
) {
  const startX = player.x;
  let fits = 0;
  let blocked = 1;
  for (let i = 0; i < CONTACT_HALVINGS; i += 1) {
    const mid = (fits + blocked) / 2;
    const y = restingY(player, { x: startX + step.dx * mid, reach: step.reach }, terrain);
    if (typeof y === "number") fits = mid;
    else blocked = mid;
  }
  const exact = Math.round((startX + step.dx * fits) * CONTACT_GRID) / CONTACT_GRID;
  const snapped = restingY(player, { x: exact, reach: step.reach }, terrain);
  const x = typeof snapped === "number" ? exact : startX + step.dx * fits;
  const y = restingY(player, { x, reach: step.reach }, terrain);
  player.x = x;
  if (typeof y === "number") player.y = y;
}

/**
 * Takes a free sub-step: onto the ground found at `y`, or, when there is none or the blob is
 * too fast to follow the edge, off it along the tangent it left from.
 */
function stepOnto(
  player: PlayerState,
  step: { y: number | "air"; dx: number; speed: number; tangent: Vec2; along: number },
  args: StepPlayersArgs
): "moved" | "air" {
  const startY = player.y;
  player.x += step.dx;
  if (step.y !== "air") {
    player.y = step.y;
    const distance = Math.hypot(step.dx, step.y - startY);
    const turn = { from: step.tangent, dir: Math.sign(step.dx), speed: step.speed, distance };
    if (!launchesOff(player, turn, args)) return "moved";
  }
  player.y = startY + step.along * step.dx;
  return "air";
}

/** One horizontal sub-step along the ground, settled onto it (slope-walking A3). */
function groundStep(
  player: PlayerState,
  step: { dx: number; speed: number },
  args: StepPlayersArgs
): GroundStep {
  const { terrain } = args;
  const tangent = groundFrame(player, terrain).tangent;
  const along = Math.abs(tangent.x) > 1e-6 ? tangent.y / tangent.x : 0;
  const reach = Math.max(1, Math.abs(step.dx) * Math.tan(args.tunables.player.slope.lipAngle));
  const y = restingY(player, { x: player.x + step.dx, reach }, terrain);
  if (y === "air" || typeof y === "number") {
    return stepOnto(player, { y, dx: step.dx, speed: step.speed, tangent, along }, args);
  }
  if (step.dx === 0) return "moved";
  if (lipIsFree(player, Math.sign(step.dx), args)) return "lip";
  walkToWall(player, { dx: step.dx, reach }, terrain);
  return "wall";
}

/** Sub-steps of at most half a sample; stops at the first step that is not a plain move. */
function walkGround(
  player: PlayerState,
  walk: { dx: number; speed: number },
  args: StepPlayersArgs
): GroundStep {
  const steps = Math.max(1, Math.ceil(Math.abs(walk.dx) / (args.terrain.cellSize / 2)));
  for (let i = 0; i < steps; i += 1) {
    const outcome = groundStep(player, { dx: walk.dx / steps, speed: walk.speed }, args);
    if (outcome !== "moved") return outcome;
  }
  return "moved";
}

/** Pulls the body up a lip (D3): straight up, then against the wall it climbs. */
function pullOverLip(player: PlayerState, speed: number, args: StepPlayersArgs): boolean {
  const startY = player.y;
  player.y -= speed * args.dt;
  if (bodyHitsSolid(player, args.terrain)) {
    player.y = startY;
    return false;
  }
  const toWall = { axis: "x" as const, delta: player.facing * speed * args.dt, slide: false };
  moveAxis(player, toWall, contactArgs(args));
  return true;
}

/**
 * Walks the ground. Steeper than the lip angle: pulls over a lip while climbing; moving down it
 * slides off; otherwise it rests up to the rest angle (hysteresis, slope-jump D1), so a blob that
 * walked up to the limit stops there instead of flipping between ground and air every step.
 */
function groundOutcome(
  player: PlayerState,
  ctx: { frame: GroundFrame; speed: number },
  args: StepPlayersArgs
): GroundStep {
  const { frame, speed } = ctx;
  const { slope } = args.tunables.player;
  const slopeSin = Math.abs(frame.tangent.y);
  if (slopeSin < Math.sin(slope.lipAngle)) {
    const dx = speed * frame.tangent.x * args.dt;
    return walkGround(player, { dx, speed: Math.abs(speed) }, args);
  }
  const climbing = speed * frame.tangent.y < 0;
  if (climbing && lipIsFree(player, player.facing, args)) {
    return pullOverLip(player, Math.abs(speed), args) ? "lip" : "wall";
  }
  const descending = speed * frame.tangent.y > 0;
  if (descending || slopeSin >= Math.sin(slope.restAngle)) return "air";
  return "rest";
}

/** Grounded motion: walk along the contour, pull over a lip, stop at a wall or leave the ground. */
function moveOnGround(player: PlayerState, args: StepPlayersArgs): void {
  const frame = groundFrame(player, args.terrain);
  const speed = groundSpeed(player, frame);
  const outcome = groundOutcome(player, { frame, speed }, args);
  reportTerrainHit(player, { x: outcome === "wall", speedX: speed, y: false, speedY: 0 });
  if (outcome === "air") {
    player.grounded = false;
    player.groundAngle = 0;
    return;
  }
  const next = groundFrame(player, args.terrain);
  // Along the ground where the body now is (the lip pull keeps its speed toward the facing side).
  const lipSpeed = player.facing * Math.abs(speed);
  const stopped = outcome === "wall" || outcome === "rest";
  const kept = stopped ? 0 : outcome === "lip" ? lipSpeed : speed;
  followGround(player, next, kept);
  // A rolling blob that runs into a wall bounces back off it.
  bounceRoll(player, args.tunables);
}

/** Axis-separated movement in the air; counts a landing on the step the feet touch down. */
function moveInAir(player: PlayerState, args: StepPlayersArgs): void {
  const contact = contactArgs(args);
  const speedX = player.vx;
  const hitX = moveAxis(player, { axis: "x", delta: player.vx * args.dt }, contact);
  if (hitX) player.vx = 0;
  const impactSpeed = player.vy;
  const hitY = moveAxis(player, { axis: "y", delta: player.vy * args.dt }, contact);
  player.grounded = hitY && impactSpeed > 0;
  if (hitY) player.vy = 0;
  reportTerrainHit(player, { x: hitX, speedX, y: hitY, speedY: impactSpeed });
  bounceRoll(player, args.tunables);
  if (player.grounded) land(player, impactSpeed, args.terrain);
}

/**
 * Air time a touchdown needs to count as a landing (collision-sound-jitter). Where the ground
 * contact flips off and on every step or two (a slope at the lip angle, a spinning or swinging
 * part, a part pushing the blob), the feet touch down again after one step at the speed of one
 * step of gravity: that is staying on the ground, not landing. The shortest real fall (a hop, a
 * step down off a ledge) takes longer. Six steps at 120 fps, like the render's contact hold.
 */
const LANDING_MIN_AIR_SECONDS = 0.05;

/**
 * Keeps the velocity along the ground (the part into it is absorbed) and, after enough air time,
 * counts the landing.
 */
function land(player: PlayerState, impactSpeed: number, terrain: TerrainGrid): void {
  if (player.airSeconds >= LANDING_MIN_AIR_SECONDS) {
    player.landCount += 1;
    player.lastLandingSpeed = impactSpeed;
  }
  const frame = groundFrame(player, terrain);
  followGround(player, frame, groundSpeed(player, frame));
}

/** Velocity `speed` along the ground, and the ground angle for the lean. */
function followGround(player: PlayerState, frame: GroundFrame, speed: number): void {
  // `+ 0` turns -0 into 0 on flat ground.
  player.vx = speed * frame.tangent.x + 0;
  player.vy = speed * frame.tangent.y + 0;
  player.groundAngle = Math.atan2(-frame.tangent.y, frame.tangent.x);
  player.groundVelocity = { x: player.vx, y: player.vy };
}

/** Velocity out of the ground above this leaves it (a knock-up, a pop): units / s. */
const LEAVE_GROUND_SPEED = 1;

/**
 * A knock-up, pop or recoil whose velocity points out of the ground lifts off it (A1). Only what
 * was added since the ground set the velocity counts: at the foot of a wall the ground frame tilts
 * toward it, and when that wall is a moving part sliding away, the ground under the body is flat
 * again on the next step, so the ground's own velocity pointed out of it and hopped the blob off
 * the floor once a slide cycle, with a landing sound (owner report, landing-sound-mover).
 */
function leaveGroundIfPushedOff(player: PlayerState, terrain: TerrainGrid): void {
  if (!player.grounded) return;
  const { normal } = groundFrame(player, terrain);
  const pushX = player.vx - player.groundVelocity.x;
  const pushY = player.vy - player.groundVelocity.y;
  if (pushX * normal.x + pushY * normal.y <= LEAVE_GROUND_SPEED) return;
  player.grounded = false;
  player.groundAngle = 0;
}

/** On the ground while velocity doesn't point out of it; else in the air. */
function applyMotion(player: PlayerState, args: StepPlayersArgs): void {
  leaveGroundIfPushedOff(player, args.terrain);
  if (player.grounded) moveOnGround(player, args);
  else moveInAir(player, args);
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
  player.airSeconds = player.grounded ? 0 : player.airSeconds + dt;
  if (player.grounded) player.airCarrySpeed = 0;
  player.wallCoyoteTimer =
    player.wallDir !== 0 ? p.coyoteTime : Math.max(0, player.wallCoyoteTimer - dt);
  player.jumpBufferTimer = Math.max(0, player.jumpBufferTimer - dt);
  player.wallJumpLockTimer = Math.max(0, player.wallJumpLockTimer - dt);
  tickRoll(player, tunables, dt);
}

/** Advances every player one fixed step. Mutates the players in place. */
export function stepPlayers(args: StepPlayersArgs): void {
  const p = args.tunables.player;
  for (const player of args.players) {
    const input = args.inputs[player.slot] ?? EMPTY_PLAYER_INPUT;
    readJumpButton(player, input, p);
    releaseRoll(player, input);
    updateCrouch(player, input);
    applyHorizontal(player, input, args);
    updateAim(player, input);
    applyJump(player, args);
    applyGravity(player, input, args);
    applyMotion(player, args);
    updateContacts(player, args);
  }
}
