import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { PlayerInput, PlayerInputs } from "@/shared/types/gameInput.types";
import { EMPTY_PLAYER_INPUT } from "@/shared/utils/gameInputMapping";
import type { Rect, Vec2 } from "@/shared/types/gameGeometry.types";
import { rectHitsSolid, type TerrainGrid } from "@/features/arena/api/arenaApi";
import type { PlayerState } from "@/features/player/types/player.types";

/**
 * Player controller system (sim step 2). Placeholder feel: instant run speed, gravity, jump
 * from the ground, axis-separated collision against the terrain grid. The movement lap replaces
 * the internals (accel curves, air steering, wall-jumps) and keeps `stepPlayers`' signature.
 */
export interface StepPlayersArgs {
  players: PlayerState[];
  inputs: PlayerInputs;
  terrain: TerrainGrid;
  tunables: GameTunables;
  /** Fixed step, seconds. */
  dt: number;
}

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
    aimX: 0,
    aimY: 0,
    prevJump: false,
  };
}

/** Puts a player back at `at` with zero velocity (respawn). */
export function placePlayer(player: PlayerState, at: Vec2): void {
  player.x = at.x;
  player.y = at.y;
  player.vx = 0;
  player.vy = 0;
  player.grounded = false;
}

export const playerBody = (player: PlayerState): Rect => ({
  x: player.x - player.width / 2,
  y: player.y - player.height,
  w: player.width,
  h: player.height,
});

/** Snaps the moving edge back to the boundary of the cell it entered. */
type Axis = "x" | "y";

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
function moveAxis(player: PlayerState, move: { axis: Axis; delta: number }, terrain: TerrainGrid) {
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

/** Reads this step's input into velocity, facing, aim and the jump impulse. */
function applyInput(player: PlayerState, input: PlayerInput, tunables: GameTunables): void {
  player.vx = input.moveX * tunables.player.runSpeed;
  if (input.moveX !== 0) player.facing = input.moveX > 0 ? 1 : -1;
  player.aimX = input.aimX;
  player.aimY = input.aimY;
  if (input.jump && !player.prevJump && player.grounded) player.vy = -tunables.player.jumpSpeed;
  player.prevJump = input.jump;
}

/** Gravity, then axis-separated movement against the terrain. */
function applyMotion(player: PlayerState, args: StepPlayersArgs): void {
  const { terrain, tunables, dt } = args;
  player.vy = Math.min(player.vy + tunables.world.gravity * dt, tunables.world.maxFallSpeed);
  if (moveAxis(player, { axis: "x", delta: player.vx * dt }, terrain)) player.vx = 0;
  const falling = player.vy > 0;
  const hitY = moveAxis(player, { axis: "y", delta: player.vy * dt }, terrain);
  player.grounded = hitY && falling;
  if (hitY) player.vy = 0;
}

/** Advances every player one fixed step. Mutates the players in place. */
export function stepPlayers(args: StepPlayersArgs): void {
  for (const player of args.players) {
    applyInput(player, args.inputs[player.slot] ?? EMPTY_PLAYER_INPUT, args.tunables);
    applyMotion(player, args);
  }
}
