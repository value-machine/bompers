import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { PlayerInputs } from "@/shared/types/gameInput.types";
import type { Vec2 } from "@/shared/types/gameGeometry.types";
import { createArenaState, type ArenaState, type LevelData } from "@/features/arena/api/arenaApi";
import {
  createPlayer,
  placePlayer,
  stepPlayers,
  type PlayerState,
} from "@/features/player/api/playerApi";

/**
 * The simulation: `stepGame(state, inputs, dt)` advances one fixed step. Pure TS, no DOM, no
 * clock; it mutates `state` in place (the terrain grid is a byte array) and returns it.
 *
 * Systems order (each later concept slots into its numbered place):
 *   1. joinSlots       — a connected input slot without a player gets one
 *   2. stepPlayers     — player feature: controller + terrain collision
 *   3. (combat)        — reserved: projectiles, blasts → arena clearCircle, damage, bash
 *   4. outOfBounds     — leaving level.outOfBounds respawns (elimination + scoring: match/combat)
 *   5. roundTimer      — counts down; at 0 the round ends and systems 1–4 stop
 */
/** Round progress (GDD § 5: points within a timed round). */
export interface MatchRoundState {
  phase: "playing" | "ended";
  remainingSeconds: number;
}

/**
 * The whole simulation state of one match. Only the match feature knows this shape; systems
 * of other features receive the slices they need (`stepPlayers({ players, terrain, … })`).
 * New concepts add one slice here (e.g. `combat: CombatState`) and one system call in `stepGame`.
 */
export interface GameState {
  /** Fixed steps simulated so far. */
  tick: number;
  /** Simulated seconds so far. */
  timeSeconds: number;
  /** Settings for this match (a copy of the defaults, possibly overridden). */
  tunables: GameTunables;
  arena: ArenaState;
  players: PlayerState[];
  round: MatchRoundState;
}

export interface CreateGameStateArgs {
  level: LevelData;
  tunables: GameTunables;
}

export function createGameState({ level, tunables }: CreateGameStateArgs): GameState {
  return {
    tick: 0,
    timeSeconds: 0,
    tunables,
    arena: createArenaState(level),
    players: [],
    round: { phase: "playing", remainingSeconds: tunables.match.durationSeconds },
  };
}

const spawnPointFor = (state: GameState, slot: number): Vec2 => {
  const points = state.arena.level.spawnPoints;
  return points[slot % points.length] ?? { x: 0, y: 0 };
};

function joinSlots(state: GameState, inputs: PlayerInputs): void {
  const maxSlots = Math.min(inputs.length, state.tunables.match.maxPlayers);
  for (let slot = 0; slot < maxSlots; slot += 1) {
    if (!inputs[slot]?.connected) continue;
    if (state.players.some((player) => player.slot === slot)) continue;
    state.players.push(createPlayer(slot, spawnPointFor(state, slot), state.tunables));
  }
}

const isOutOfBounds = (player: PlayerState, state: GameState): boolean => {
  const zone = state.arena.level.outOfBounds;
  return (
    player.x < zone.x ||
    player.x > zone.x + zone.width ||
    player.y < zone.y ||
    player.y > zone.y + zone.height
  );
};

function outOfBounds(state: GameState): void {
  for (const player of state.players) {
    if (isOutOfBounds(player, state)) placePlayer(player, spawnPointFor(state, player.slot));
  }
}

function roundTimer(state: GameState, dt: number): void {
  state.round.remainingSeconds = Math.max(0, state.round.remainingSeconds - dt);
  if (state.round.remainingSeconds === 0) state.round.phase = "ended";
}

/** Advances the game one fixed step of `dt` seconds. */
export function stepGame(state: GameState, inputs: PlayerInputs, dt: number): GameState {
  if (state.round.phase === "playing") {
    joinSlots(state, inputs);
    stepPlayers({
      players: state.players,
      inputs,
      terrain: state.arena.terrain,
      tunables: state.tunables,
      dt,
    });
    outOfBounds(state);
    roundTimer(state, dt);
  }
  state.tick += 1;
  state.timeSeconds += dt;
  return state;
}
