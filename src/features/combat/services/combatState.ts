import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { Rect } from "@/shared/types/gameGeometry.types";
import type { TerrainGrid } from "@/features/arena/api/arenaApi";
import type { PlayerState } from "@/features/player/api/playerApi";
import type {
  CombatEventBody,
  CombatState,
  DamageCause,
  EliminationCause,
  FighterState,
} from "@/features/combat/types/combat.types";

/**
 * Combat state bookkeeping: creation, the event log, fighters (health, elimination, respawn).
 * Pure TS; every function mutates the combat slice it is given.
 */
/** What every combat system reads during one step. */
export interface CombatContext {
  combat: CombatState;
  players: PlayerState[];
  terrain: TerrainGrid;
  /** The level's in-bounds area: rockets explode and pickups vanish outside it. */
  bounds: Rect;
  tunables: GameTunables;
  timeSeconds: number;
}

export function createCombatState(tunables: GameTunables): CombatState {
  return {
    fighters: new Map(),
    rockets: [],
    pickups: [],
    events: [],
    nextSeq: 1,
    nextEntityId: 1,
    dropTimer: tunables.combat.drops.firstDelaySeconds,
    nextDropIndex: 0,
  };
}

/** Appends a sim event stamped with the next sequence number. */
export function emitCombatEvent(
  combat: CombatState,
  event: CombatEventBody,
  timeSeconds: number
): void {
  combat.events.push({ ...event, seq: combat.nextSeq, timeSeconds });
  combat.nextSeq += 1;
}

/** Drops events older than the retention window (consumers read them by `seq` before that). */
export function pruneCombatEvents(combat: CombatState, oldestKept: number): void {
  const firstKept = combat.events.findIndex((event) => event.timeSeconds >= oldestKept);
  if (firstKept === -1) combat.events.length = 0;
  else if (firstKept > 0) combat.events.splice(0, firstKept);
}

const createFighter = (player: PlayerState, tunables: GameTunables): FighterState => ({
  playerId: player.id,
  slot: player.slot,
  health: tunables.combat.maxHealth,
  eliminated: false,
  invulnerableUntil: 0,
  weapon: null,
  prevFire: false,
  attackCooldown: 0,
  lastHitBySlot: null,
  lastHitAt: 0,
});

/** The fighter of a player, created with full health on first sight. */
export function fighterFor(
  combat: CombatState,
  player: PlayerState,
  tunables: GameTunables
): FighterState {
  const existing = combat.fighters.get(player.id);
  if (existing) return existing;
  const fighter = createFighter(player, tunables);
  combat.fighters.set(player.id, fighter);
  return fighter;
}

export const isFighterEliminated = (combat: CombatState, playerId: string): boolean =>
  combat.fighters.get(playerId)?.eliminated === true;

export interface DamageArgs {
  combat: CombatState;
  victim: FighterState;
  byPlayerSlot: number | null;
  cause: DamageCause;
  timeSeconds: number;
}

/**
 * Removes exactly one health chunk unless the victim is protected or already out. At 0 the
 * fighter is flagged eliminated (match step 4 respawns it). Returns whether damage landed.
 */
export function damageFighter(args: DamageArgs): boolean {
  const { combat, victim, byPlayerSlot, cause, timeSeconds } = args;
  if (victim.eliminated || timeSeconds < victim.invulnerableUntil) return false;
  victim.health = Math.max(0, victim.health - 1);
  victim.lastHitBySlot = byPlayerSlot;
  victim.lastHitAt = timeSeconds;
  const victimSlot = victim.slot;
  emitCombatEvent(
    combat,
    { type: "playerHit", victimSlot, byPlayerSlot, cause, healthLeft: victim.health },
    timeSeconds
  );
  if (victim.health === 0) {
    victim.eliminated = true;
    emitCombatEvent(
      combat,
      { type: "playerEliminated", victimSlot, byPlayerSlot, cause },
      timeSeconds
    );
  }
  return true;
}

export interface EliminateArgs {
  combat: CombatState;
  player: PlayerState;
  cause: EliminationCause;
  tunables: GameTunables;
  timeSeconds: number;
}

/**
 * Eliminates a player for a non-combat cause (falling out of bounds). The last hitter within
 * `killCreditSeconds` gets the credit. No-op when the fighter is already eliminated.
 */
export function eliminateFighter(args: EliminateArgs): void {
  const { combat, player, cause, tunables, timeSeconds } = args;
  const fighter = fighterFor(combat, player, tunables);
  if (fighter.eliminated) return;
  const recent = timeSeconds - fighter.lastHitAt <= tunables.combat.killCreditSeconds;
  const byPlayerSlot = recent ? fighter.lastHitBySlot : null;
  fighter.health = 0;
  fighter.eliminated = true;
  emitCombatEvent(
    combat,
    { type: "playerEliminated", victimSlot: fighter.slot, byPlayerSlot, cause },
    timeSeconds
  );
}

/** Back in play after a respawn: full health, unarmed, no pending credit. */
export function respawnFighter(
  combat: CombatState,
  player: PlayerState,
  tunables: GameTunables
): void {
  const fighter = fighterFor(combat, player, tunables);
  fighter.health = tunables.combat.maxHealth;
  fighter.eliminated = false;
  fighter.weapon = null;
  fighter.attackCooldown = 0;
  fighter.lastHitBySlot = null;
}
