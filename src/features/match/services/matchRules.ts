import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { PlayerInputs } from "@/shared/types/gameInput.types";
import type { Rect, Vec2 } from "@/shared/types/gameGeometry.types";
import { maxBlastPush } from "@/shared/utils/blastPower";
import {
  eliminateFighter,
  maxWeaponRecoil,
  respawnFighter,
  type CombatEvent,
  type CombatState,
} from "@/features/combat/api/combatApi";
import type { OrbCollected } from "@/features/collectibles/api/collectiblesApi";
import { placePlayer, type PlayerState } from "@/features/player/api/playerApi";
import { resetDive, type DiveState } from "@/features/dive/api/diveApi";
import { chooseSpawnIndex } from "@/features/match/services/spawnChoice";

/**
 * Match rules (sim step 5, GDD § 5 and § 6): scoring from combat's elimination events and from
 * point orbs, the respawn queue (eliminated players wait out of play), spawn choice and spawn
 * protection. Pure TS; mutates the slices it is given. Decisions: match-rules D1–D6.
 */
export interface MatchRulesState {
  /** Points by slot. */
  scores: number[];
  /** Player id → sim time of the respawn, for players waiting out of play. */
  respawnAt: Map<string, number>;
  /** Highest combat event `seq` already scored. */
  lastSeq: number;
}

type Scoring = GameTunables["match"]["scoring"];

export function createMatchRulesState(maxPlayers: number): MatchRulesState {
  return { scores: Array.from({ length: maxPlayers }, () => 0), respawnAt: new Map(), lastSeq: 0 };
}

/** False while the player waits to respawn (not stepped, hit, drawn or framed). */
export const isInPlay = (rules: MatchRulesState, player: PlayerState): boolean =>
  !rules.respawnAt.has(player.id);

const addPoints = (scores: number[], slot: number, points: number): void => {
  scores[slot] = (scores[slot] ?? 0) + points;
};

/**
 * A credited kill scores for the killer; an elimination nobody else gets credit for (falling
 * off alone, or a self-credited one) costs the victim `fallPenalty`.
 */
export function scoreEvent(scores: number[], event: CombatEvent, scoring: Scoring): void {
  if (event.type !== "playerEliminated") return;
  const { byPlayerSlot, victimSlot } = event;
  if (byPlayerSlot !== null && byPlayerSlot !== victimSlot) {
    addPoints(scores, byPlayerSlot, scoring.kill);
  } else {
    addPoints(scores, victimSlot, -scoring.fallPenalty);
  }
}

/** Scores every combat event not seen yet (events are read by `seq`, combat D3). */
export function scoreCombatEvents(
  rules: MatchRulesState,
  events: readonly CombatEvent[],
  scoring: Scoring
): void {
  for (const event of events) {
    if (event.seq <= rules.lastSeq) continue;
    scoreEvent(rules.scores, event, scoring);
    rules.lastSeq = event.seq;
  }
}

export function awardOrbs(
  rules: MatchRulesState,
  collected: readonly OrbCollected[],
  scoring: Scoring
): void {
  for (const orb of collected) addPoints(rules.scores, orb.slot, scoring.orb);
}

export interface StepMatchRulesArgs {
  rules: MatchRulesState;
  combat: CombatState;
  /** Dive slice: a respawning player gets a fresh dive. */
  dive: DiveState;
  players: PlayerState[];
  spawns: readonly Vec2[];
  /** The level's in-bounds area (the respawn fallback is its middle). */
  bounds: Rect;
  /** Leaving this area eliminates a player (`killZoneOf`: far past the sides and top). */
  killZone: Rect;
  tunables: GameTunables;
  timeSeconds: number;
}

/**
 * How far past the level bounds' sides and top the kill lines lie, derived from movement
 * (open-map-edges D1a). The fastest single launch is a jump plus a point-blank blast and the
 * strongest weapon recoil (a rocket jump off a jump, jumps-and-recoil D2; one shot per launch,
 * homing-missiles D5): it climbs `v² / 2g`. The margin
 * is twice that, room for a second full launch
 * chained on top; it is also the 45° flight range `v² / g` of that launch, so it covers sideways
 * flights too. Uses the match's effective gravity (engine × lobby × level).
 */
export function outOfBoundsMargin(tunables: GameTunables): number {
  const recoil = maxWeaponRecoil(tunables);
  const launchSpeed = tunables.player.jumpSpeed + maxBlastPush(tunables) + recoil;
  return (launchSpeed * launchSpeed) / tunables.world.gravity;
}

/**
 * The kill zone: leaving it eliminates a player, and rockets and crates vanish outside it. The
 * level bounds grown by `outOfBoundsMargin` on the left, right and top, so nobody notices those
 * kill lines even with chained jumps; the bottom stays put (falling off is lethal right there).
 */
export function killZoneOf(bounds: Rect, tunables: GameTunables): Rect {
  const margin = outOfBoundsMargin(tunables);
  return {
    x: bounds.x - margin,
    y: bounds.y - margin,
    w: bounds.w + margin * 2,
    h: bounds.h + margin,
  };
}

const isOutside = (player: PlayerState, zone: Rect): boolean =>
  player.x < zone.x ||
  player.x > zone.x + zone.w ||
  player.y < zone.y ||
  player.y > zone.y + zone.h;

function eliminateOutOfBounds(args: StepMatchRulesArgs): void {
  const { combat, tunables, timeSeconds } = args;
  for (const player of args.players) {
    if (!isInPlay(args.rules, player) || !isOutside(player, args.killZone)) continue;
    eliminateFighter({ combat, player, cause: "out-of-bounds", tunables, timeSeconds });
  }
}

function queueRespawns(args: StepMatchRulesArgs): void {
  const { rules, combat, tunables, timeSeconds } = args;
  for (const player of args.players) {
    if (!combat.fighters.get(player.id)?.eliminated || rules.respawnAt.has(player.id)) continue;
    rules.respawnAt.set(player.id, timeSeconds + tunables.match.respawnDelaySeconds);
  }
}

function respawn(args: StepMatchRulesArgs, player: PlayerState): void {
  const { rules, combat, tunables, timeSeconds } = args;
  rules.respawnAt.delete(player.id);
  const opponents = args.players
    .filter((other) => other.id !== player.id && isInPlay(rules, other))
    .map((other) => ({ x: other.x, y: other.y }));
  const index = chooseSpawnIndex({ spawns: args.spawns, opponents, slot: player.slot });
  // A level without spawns (normalisation only warns) respawns in the middle of the bounds,
  // never where the player fell out.
  const { bounds } = args;
  const centre = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
  placePlayer(player, args.spawns[index] ?? centre);
  respawnFighter(combat, player, tunables);
  // A fresh start: `placePlayer` ended any roll; the dive forgets its phase and cooldown.
  resetDive(args.dive, player);
  const fighter = combat.fighters.get(player.id);
  if (fighter) fighter.invulnerableUntil = timeSeconds + tunables.match.spawnProtectionSeconds;
}

/**
 * Step 5: out of the kill zone → elimination (combat credits the last hitter within
 * `killCreditSeconds`), score new events, queue eliminated players, respawn the due ones.
 */
export function stepMatchRules(args: StepMatchRulesArgs): void {
  eliminateOutOfBounds(args);
  scoreCombatEvents(args.rules, args.combat.events, args.tunables.match.scoring);
  queueRespawns(args);
  for (const player of args.players) {
    const due = args.rules.respawnAt.get(player.id);
    if (due !== undefined && args.timeSeconds >= due) respawn(args, player);
  }
}

/** Slots with the top score among the players who joined (several = a draw). */
export function roundWinners(scores: readonly number[], slots: readonly number[]): number[] {
  if (slots.length === 0) return [];
  const top = Math.max(...slots.map((slot) => scores[slot] ?? 0));
  return slots.filter((slot) => (scores[slot] ?? 0) === top).sort((a, b) => a - b);
}

export interface RestartPressArgs {
  phase: "playing" | "ended";
  /** Sim seconds since the round ended. */
  secondsSinceEnd: number;
  lockSeconds: number;
  inputs: PlayerInputs;
  previous: PlayerInputs;
}

/** The round has ended and its result has been shown for the lock time (rematch or lobby). */
export const isPastRestartLock = (args: Omit<RestartPressArgs, "inputs" | "previous">): boolean =>
  args.phase === "ended" && args.secondsSinceEnd >= args.lockSeconds;

/** A jump press (not a held jump) on any slot, once the round has been over for the lock time. */
export function isRestartPress(args: RestartPressArgs): boolean {
  if (!isPastRestartLock(args)) return false;
  return args.inputs.some((input, slot) => input.jump && !args.previous[slot]?.jump);
}

/** The round-result title: one winner, a draw between several, or nobody joined. */
export function roundResultLabel(winners: readonly number[]): string {
  const names = winners.map((slot) => `P${slot + 1}`);
  if (names.length === 0) return "Time!";
  if (names.length === 1) return `${names[0]} wins!`;
  return `Draw: ${names.join(" & ")}`;
}
