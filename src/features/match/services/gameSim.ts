import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { PlayerInputs } from "@/shared/types/gameInput.types";
import type { Rect, Vec2 } from "@/shared/types/gameGeometry.types";
import { createArenaState, type ArenaState } from "@/features/arena/api/arenaApi";
import {
  normalizeLevelDefinition,
  type LevelDefinition,
  type LevelSettings,
} from "@/features/level/api/levelApi";
import {
  createCombatState,
  stepCombat,
  takeWeaponPickups,
  type CombatState,
} from "@/features/combat/api/combatApi";
import {
  createCollectiblesState,
  stepCollectibles,
  stepDiveRefills,
  stepWeaponCrates,
  type CollectiblesState,
} from "@/features/collectibles/api/collectiblesApi";
import {
  createPlayer,
  resolveBodyContacts,
  stepPlayers,
  type PlayerState,
} from "@/features/player/api/playerApi";
import {
  createDiveState,
  isDiveSpent,
  refillDive,
  requestDive,
  stepDives,
  type DiveState,
} from "@/features/dive/api/diveApi";
import {
  awardOrbs,
  createMatchRulesState,
  isInPlay,
  killZoneOf,
  roundWinners,
  stepMatchRules,
  type MatchRulesState,
} from "@/features/match/services/matchRules";

/**
 * The simulation: `stepGame(state, inputs, dt)` advances one fixed step. Pure TS, no DOM, no
 * clock; it mutates `state` in place (the terrain grid is a byte array) and returns it.
 *
 * Systems order (each later concept slots into its numbered place):
 *   1. joinSlots       — a connected input slot without a player gets one
 *   2. stepPlayers     — player feature: controller + terrain collision
 *   2b. bodyContacts   — player feature: blob-vs-blob bounce; the contacts feed step 3b
 *   3. stepCombat      — combat feature: rockets, blasts (damage, impulse, clearCrater);
 *                        unarmed fire goes through its `unarmedAttack` hook to the dive
 *   3a. stepWeaponCrates — collectibles feature: weapon crates drop, fall, land and get taken;
 *                        combat's `takeWeaponPickups` arms the collector
 *   3b. stepDives      — dive feature: the unarmed attack; its hits go through combat's `applyHit`
 *   4. stepHeadbuttResets — collectibles feature: a player with a spent dive touching a headbutt
 *                        reset takes it; the dive feature's `refillDive` gives the charge back
 *   4. stepCollectibles — collectibles feature: point orbs fall from the sky; touching one scores
 *   5. stepMatchRules  — out of the kill zone → elimination; scoring; eliminated players wait
 *                        `respawnDelaySeconds`, then respawn at the spawn farthest from opponents
 *                        with spawn protection and a fresh dive
 *   6. roundTimer      — counts down; at 0 the round ends (winners fixed) and systems 1–5 stop
 *
 * Steps 2–4 receive only the players in play: a player waiting to respawn is not moved, bumped,
 * hit or able to collect.
 */
/** Round progress (GDD § 5: points within a timed round). */
export interface MatchRoundState {
  phase: "playing" | "ended";
  remainingSeconds: number;
  /** Sim time the round ended, or null while playing. */
  endedAt: number | null;
  /** Slots with the top score at the end (several = a draw); empty while playing. */
  winners: number[];
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
  /**
   * Leaving it eliminates; rockets and crates vanish outside it (`killZoneOf`: the level bounds,
   * grown far past the sides and top from this match's tunables).
   */
  killZone: Rect;
  /** What normalising the level corrected (unknown IDs etc.); empty for a clean level. */
  levelWarnings: string[];
  players: PlayerState[];
  /** Health, weapons, rockets and the combat event log (keyed by player id). */
  combat: CombatState;
  /** Unarmed attack (dive headbutt) state; `dive.hits` holds the last step's hits. */
  dive: DiveState;
  /** Sky drops: point orbs falling onto the collectible points, weapon crates from the drop points. */
  collectibles: CollectiblesState;
  /** Scores and the respawn queue. */
  rules: MatchRulesState;
  round: MatchRoundState;
}

export interface CreateGameStateArgs {
  /** Any level; it is normalised against the content catalog here. */
  level: LevelDefinition;
  /** Engine defaults (or lobby overrides); the level's settings apply on top. */
  tunables: GameTunables;
}

/** Per-level settings on top of the engine tunables (gravity is a multiplier). */
export function applyLevelSettings(tunables: GameTunables, settings: LevelSettings): GameTunables {
  return {
    ...tunables,
    world: { ...tunables.world, gravity: tunables.world.gravity * settings.gravity },
    match: {
      ...tunables.match,
      durationSeconds: settings.matchDurationS ?? tunables.match.durationSeconds,
    },
  };
}

export function createGameState({ level, tunables }: CreateGameStateArgs): GameState {
  const normalized = normalizeLevelDefinition(level);
  const matchTunables = applyLevelSettings(tunables, normalized.level.settings);
  return {
    tick: 0,
    timeSeconds: 0,
    tunables: matchTunables,
    arena: createArenaState(normalized.level),
    killZone: killZoneOf(normalized.level.bounds, matchTunables),
    levelWarnings: normalized.warnings,
    players: [],
    combat: createCombatState(),
    dive: createDiveState(),
    collectibles: createCollectiblesState(matchTunables, normalized.level.collectibles),
    rules: createMatchRulesState(matchTunables.match.maxPlayers),
    round: {
      phase: "playing",
      remainingSeconds: matchTunables.match.durationSeconds,
      endedAt: null,
      winners: [],
    },
  };
}

const spawnPointFor = (state: GameState, slot: number): Vec2 => {
  const points = state.arena.level.spawns;
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

/** Players in play: not waiting to respawn and not eliminated earlier in this step. */
export const playersInPlay = (state: GameState): PlayerState[] =>
  state.players.filter(
    (player) =>
      isInPlay(state.rules, player) && state.combat.fighters.get(player.id)?.eliminated !== true
  );

function roundTimer(state: GameState, dt: number): void {
  const { round } = state;
  round.remainingSeconds = Math.max(0, round.remainingSeconds - dt);
  if (round.remainingSeconds > 0) return;
  round.phase = "ended";
  round.endedAt = state.timeSeconds + dt;
  const slots = state.players.map((player) => player.slot);
  round.winners = roundWinners(state.rules.scores, slots);
}

/** Step 3a: right after combat, so a player eliminated by a rocket this step cannot collect. */
function stepCratePickups(state: GameState, dt: number): void {
  const { tunables, timeSeconds } = state;
  const { level, terrain } = state.arena;
  const players = playersInPlay(state);
  const pickups = stepWeaponCrates({
    crates: state.collectibles.crates,
    drops: level.drops,
    players,
    terrain,
    bounds: state.killZone,
    tunables,
    dt,
  });
  takeWeaponPickups({ combat: state.combat, players, tunables, timeSeconds }, pickups);
}

/**
 * Step 4 (before the orbs): headbutt resets. Only players in play whose dive charge is spent may
 * take one (headbutt-reset D2); taking it refills their dive mid-flight.
 */
function stepHeadbuttResets(state: GameState, dt: number): void {
  const spent = playersInPlay(state).filter((player) => isDiveSpent(state.dive, player));
  const taken = stepDiveRefills({
    refills: state.collectibles.diveRefills,
    players: spent,
    tunables: state.tunables,
    dt,
  });
  for (const { slot } of taken) {
    const player = spent.find((candidate) => candidate.slot === slot);
    if (player) refillDive(state.dive, player);
  }
}

function stepPlay(state: GameState, inputs: PlayerInputs, dt: number): void {
  const { tunables, timeSeconds } = state;
  const { level, terrain } = state.arena;
  joinSlots(state, inputs);
  const players = playersInPlay(state);
  stepPlayers({ players, inputs, terrain, tunables, dt });
  const contacts = resolveBodyContacts({ players, terrain, tunables });
  stepCombat({
    combat: state.combat,
    players,
    inputs,
    terrain,
    bounds: state.killZone,
    tunables,
    timeSeconds,
    dt,
    unarmedAttack: ({ attacker }) => requestDive(state.dive, attacker, tunables),
  });
  stepCratePickups(state, dt);
  // The same in-play list as the contacts: a blob eliminated by a rocket this step still
  // finishes its bounce, and `applyHit` refuses damage on it.
  stepDives({
    dive: state.dive,
    players,
    combat: state.combat,
    contacts,
    tunables,
    timeSeconds,
    dt,
  });
  stepHeadbuttResets(state, dt);
  const collected = stepCollectibles({
    collectibles: state.collectibles,
    points: level.collectibles,
    // Re-read: a player eliminated in step 3 cannot collect in the same step.
    players: playersInPlay(state),
    tunables,
    dt,
  });
  awardOrbs(state.rules, collected, tunables.match.scoring);
  stepMatchRules({
    rules: state.rules,
    combat: state.combat,
    dive: state.dive,
    players: state.players,
    spawns: level.spawns,
    bounds: level.bounds,
    killZone: state.killZone,
    tunables,
    timeSeconds,
  });
  roundTimer(state, dt);
}

/** Advances the game one fixed step of `dt` seconds. */
export function stepGame(state: GameState, inputs: PlayerInputs, dt: number): GameState {
  if (state.round.phase === "playing") stepPlay(state, inputs, dt);
  state.tick += 1;
  state.timeSeconds += dt;
  return state;
}
