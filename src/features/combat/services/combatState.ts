import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { Rect, Vec2 } from "@/shared/types/gameGeometry.types";
import type { TerrainGrid } from "@/features/arena/api/arenaApi";
import type { PlayerState } from "@/features/player/api/playerApi";
import type {
  CombatEventBody,
  CombatState,
  CrushSqueeze,
  EliminationCause,
  FighterState,
  Hit,
  HitKind,
  HitZone,
} from "@/features/combat/types/combat.types";

/**
 * Combat state bookkeeping: creation, the event log, fighters (health, hits, elimination,
 * respawn).
 * Pure TS; every function mutates the combat slice it is given.
 */
/** What every combat system reads during one step. */
export interface CombatContext {
  combat: CombatState;
  players: PlayerState[];
  terrain: TerrainGrid;
  /** The in-bounds area (the match passes its kill zone): rockets explode outside it. */
  bounds: Rect;
  tunables: GameTunables;
  timeSeconds: number;
  /** Round bodies rockets explode on besides terrain and players (physics objects); none = []. */
  roundBodies?: readonly { center: Vec2; radius: number }[];
}

export function createCombatState(): CombatState {
  return {
    fighters: new Map(),
    rockets: [],
    events: [],
    beamClashes: [],
    bonusDamage: new Map(),
    nextSeq: 1,
    nextEntityId: 1,
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
  spraying: false,
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

export interface EliminateArgs {
  combat: CombatState;
  player: PlayerState;
  cause: EliminationCause;
  tunables: GameTunables;
  timeSeconds: number;
  /** A crush's squeeze (moving parts), passed on in the event. */
  squeeze?: CrushSqueeze;
}

/**
 * Eliminates a player for a non-combat cause (falling out of bounds, crushed by a moving part). The last hitter within
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
    {
      type: "playerEliminated",
      victimSlot: fighter.slot,
      byPlayerSlot,
      cause,
      overkill: false,
      ...(args.squeeze && { squeeze: args.squeeze }),
      ...victimMotion(player),
    },
    timeSeconds
  );
}

/** Logs a moving part's author-declared sound (moving-parts B2) for the sound layer. */
export function reportPartSound(
  combat: CombatState,
  report: { soundId: string; at: Vec2; timeSeconds: number }
): void {
  const { soundId, at, timeSeconds } = report;
  emitCombatEvent(combat, { type: "partSound", soundId, x: at.x, y: at.y }, timeSeconds);
}

/** Where the victim is and how it moves at the moment it is eliminated (knockout render). */
const victimMotion = (player: PlayerState) => ({
  x: player.x,
  y: player.y,
  vx: player.vx,
  vy: player.vy,
});

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

// ── Hits ─────────────────────────────────────────────────────────────────────

/**
 * The one damage path for every attack (rockets, the dive): zone → damage from the
 * `combat.hitDamage` table → health, spawn protection, `playerHit` / `playerEliminated` events.
 * No attack hard-codes its damage; changing the rules (e.g. front hits only bounce, back hits
 * deal 4) is a tunables edit. Knockback and impulses stay with each attack.
 */
export type HitWorld = Pick<CombatContext, "combat" | "players" | "tunables" | "timeSeconds">;

export interface HitResult {
  /** False when the victim was protected, already eliminated or not in play. */
  landed: boolean;
  zone: HitZone;
  damage: number;
}

/**
 * Front when the hit travels against the victim's facing (it meets their face), back when it
 * travels the same way (it comes from behind). A purely vertical hit counts as front.
 */
export function classifyHitZone(victimFacing: -1 | 1, direction: Vec2): HitZone {
  return direction.x * victimFacing > 0 ? "back" : "front";
}

/** Chunks a hit of this kind removes on this zone (configuration only). */
export const hitDamageFor = (
  table: HitWorld["tunables"]["combat"]["hitDamage"],
  kind: HitKind,
  zone: HitZone
): number => table[kind][zone];

/** Damage a crouching victim takes: scaled and rounded down, so a 1-chunk hit deals 0 (crouch D1). */
export const crouchDamage = (damage: number, scale: number): number => Math.floor(damage * scale);

const playerInSlot = (world: HitWorld, slot: number): PlayerState | undefined =>
  world.players.find((player) => player.slot === slot);

function emitHit(
  world: HitWorld,
  hit: Hit,
  result: HitResult & { healthLeft: number; bonus: number }
): void {
  emitCombatEvent(
    world.combat,
    {
      type: "playerHit",
      victimSlot: hit.victimSlot,
      byPlayerSlot: hit.attackerSlot,
      source: hit.source,
      kind: hit.kind,
      zone: result.zone,
      damage: result.damage,
      healthLeft: result.healthLeft,
      ...(result.bonus > 0 ? { bonus: true as const } : {}),
      x: hit.contactPoint.x,
      y: hit.contactPoint.y,
    },
    world.timeSeconds
  );
}

interface Elimination {
  hit: Hit;
  fighter: FighterState;
  victim: PlayerState;
  overkill: boolean;
}

function eliminate(world: HitWorld, { hit, fighter, victim, overkill }: Elimination): void {
  fighter.eliminated = true;
  emitCombatEvent(
    world.combat,
    {
      type: "playerEliminated",
      victimSlot: hit.victimSlot,
      byPlayerSlot: hit.attackerSlot,
      cause: hit.source,
      overkill,
      ...victimMotion(victim),
    },
    world.timeSeconds
  );
}

/**
 * Takes the damage off (never below 0) and records the attacker for credit. Returns true for an
 * overkill: the hit would have taken health below 0 (owner, elimination-goo lap), so the
 * knockout bursts on the spot instead of flying first.
 */
function takeDamage(
  fighter: FighterState,
  {
    damage,
    attackerSlot,
    timeSeconds,
  }: { damage: number; attackerSlot: number | null; timeSeconds: number }
): boolean {
  const overkill = damage > fighter.health;
  fighter.health = Math.max(0, fighter.health - damage);
  fighter.lastHitBySlot = attackerSlot;
  fighter.lastHitAt = timeSeconds;
  return overkill;
}

/**
 * Chunks a hit takes: the table's for its kind and zone, halved while crouching (not fire:
 * fire-burn D5), plus the slot's `bonusDamage` (not fire either: it melts, it does not break).
 */
function damageOf(world: HitWorld, hit: Hit, at: { victim: PlayerState; zone: HitZone }) {
  const { combat } = world.tunables;
  const base = hitDamageFor(combat.hitDamage, hit.kind, at.zone);
  if (hit.kind === "burn") return { damage: base, bonus: 0 };
  const bonus = world.combat.bonusDamage.get(hit.victimSlot) ?? 0;
  const own = at.victim.crouching ? crouchDamage(base, combat.crouchDamageScale) : base;
  return { damage: own + bonus, bonus };
}

/**
 * Applies one hit to the player in `hit.victimSlot`. Respects `invulnerableUntil`, records the
 * attacker for elimination credit, and at 0 health flags the fighter eliminated (match step 4
 * respawns it) with a `playerEliminated` event.
 */
export function applyHit(world: HitWorld, hit: Hit): HitResult {
  const { combat, tunables, timeSeconds } = world;
  const victim = playerInSlot(world, hit.victimSlot);
  const zone = victim ? classifyHitZone(victim.facing, hit.direction) : "front";
  if (!victim) return { landed: false, zone, damage: 0 };
  const { damage, bonus } = damageOf(world, hit, { victim, zone });
  const fighter = fighterFor(combat, victim, tunables);
  if (fighter.eliminated || timeSeconds < fighter.invulnerableUntil) {
    return { landed: false, zone, damage: 0 };
  }
  const overkill = takeDamage(fighter, { damage, attackerSlot: hit.attackerSlot, timeSeconds });
  // One shatter per block: a second hit in the same step takes no bonus.
  if (bonus > 0) combat.bonusDamage.delete(hit.victimSlot);
  emitHit(world, hit, { landed: true, zone, damage, healthLeft: fighter.health, bonus });
  if (fighter.health === 0) eliminate(world, { hit, fighter, victim, overkill });
  return { landed: true, zone, damage };
}
