import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { Vec2 } from "@/shared/types/gameGeometry.types";
import type { PlayerInputs } from "@/shared/types/gameInput.types";
import {
  endRoll,
  isRolling,
  isRollLocked,
  reactToHit,
  startRoll,
  type BodyContact,
  type PlayerState,
} from "@/features/player/api/playerApi";
import type { DiveHit, DiveMotion, DiveState, DiveTrigger } from "@/features/dive/types/dive.types";
import { applyHit, type CombatState } from "@/features/combat/api/combatApi";
import { directHitPush } from "@/shared/utils/blastPower";
import { magnetDirection } from "@/features/dive/services/diveMagnet";
import { resolveReachContacts } from "@/features/dive/services/diveReach";

/**
 * Dive headbutt system (sim step 3b, after players, body contacts and combat). Unarmed fire
 * (combat's `unarmedAttack` hook → `requestDive`) makes the blob dive
 * headfirst along its 16-way aim: idle → wind-up (hang and crouch) → travel (dead straight, no
 * gravity, no steering) → recovery. Terrain always ends the dive: a head-on hit is a short stun
 * ("bonk"), a glancing one a plain recovery; it never bounces. A body contact while travelling
 * toward someone is a hit: the body collision already exchanged the momentum; the dive adds
 * its strike, ricochets the attacker up with the dive ready again, and deals the damage through
 * combat's `applyHit` (kind "contact", source "dive").
 *
 * The dive never moves a player itself. It writes velocity at events (launch, bonk, strike)
 * and the controller's motion modifiers (`steerScale`, `gravityScale`, `jumpLocked`) each step.
 */
export interface StepDivesArgs {
  dive: DiveState;
  players: PlayerState[];
  /** Combat slice: hits go through its `applyHit` (health, spawn protection, events). */
  combat: CombatState;
  /** This step's blob-vs-blob contacts (`resolveBodyContacts`). */
  contacts: readonly BodyContact[];
  /** This step's inputs: fire still held when a dive ends rolls on (dash-hold). */
  inputs?: PlayerInputs;
  tunables: GameTunables;
  /** Sim time at the start of this step, seconds. */
  timeSeconds: number;
  /** Fixed step, seconds. */
  dt: number;
}

type DiveTunables = GameTunables["dive"];

/** Seconds a landed hit stays in `recentHits` for the impact effect. */
export const RECENT_HIT_SECONDS = 0.25;
/** Timer comparisons tolerate float drift so durations land on whole steps. */
const EPSILON = 1e-9;
/** Share of the sideways speed kept on a head-on terrain bonk. */
const BONK_SLIDE_KEEP = 0.3;
/**
 * The aim is snapped to 16 directions (22.5° steps) so the dive line stays readable. Keyboard aim
 * only produces the 8 main ones; sticks reach all 16 (owner, 2026-11-16).
 */
const AIM_STEP = Math.PI / 8;

export const createDiveState = (): DiveState => ({
  motions: {},
  refillCounts: {},
  airJumpPressesRead: {},
  deniedCounts: {},
  hits: [],
  recentHits: [],
});

const createDiveMotion = (): DiveMotion => ({
  phase: "idle",
  phaseSeconds: 0,
  phaseDuration: 0,
  dirX: 1,
  dirY: 0,
  trigger: "fire",
  launchSpeed: 0,
  charged: true,
  cooldown: 0,
  fireBuffer: 0,
  sinceDenied: Number.POSITIVE_INFINITY,
  bonked: false,
  stagger: 0,
  sinceRicochet: Number.POSITIVE_INFINITY,
});

function motionOf(dive: DiveState, player: PlayerState): DiveMotion {
  return (dive.motions[player.id] ??= createDiveMotion());
}

/**
 * A fire press by an unarmed player (combat's `unarmedAttack` hook calls this once per press).
 * The press is buffered (`fireBufferSeconds`): the dive starts as soon as it is available, or the
 * press is denied (dash-feel lap).
 */
export function requestDive(dive: DiveState, player: PlayerState, tunables: GameTunables): void {
  motionOf(dive, player).fireBuffer = tunables.dive.fireBufferSeconds;
}

/**
 * True when an airborne player has used this airtime's dive and not got it back yet. A wind-up
 * on the ground does not count: the charge returns on landing anyway.
 */
export const isDiveSpent = (dive: DiveState, player: PlayerState): boolean =>
  !player.grounded && dive.motions[player.id]?.charged === false;

/**
 * A headbutt reset pickup: the charge is back at once, even mid-flight, and the between-dives
 * cooldown is waived, so the next dive is ready as soon as the current one has recovered
 * (headbutt-reset D4). A dive still travelling keeps going; its recovery still plays.
 */
export function refillDive(dive: DiveState, player: PlayerState): void {
  const motion = motionOf(dive, player);
  motion.charged = true;
  const recoveryLeft =
    motion.phase === "recovery" ? Math.max(0, motion.phaseDuration - motion.phaseSeconds) : 0;
  motion.cooldown = Math.min(motion.cooldown, recoveryLeft);
  dive.refillCounts[player.id] = (dive.refillCounts[player.id] ?? 0) + 1;
}

/** Forgets a player's dive (respawn): idle, charged, no cooldown. */
export function resetDive(dive: DiveState, player: PlayerState): void {
  dive.motions[player.id] = createDiveMotion();
}

// ── Phase changes ────────────────────────────────────────────────────────────

/**
 * Unit dive direction: the player's aim snapped to 16 ways. A jump dive with no aim input goes
 * straight up, a bashing double jump (double-jump-bash D17); a fire dive keeps the facing fallback.
 */
function diveDirection(player: PlayerState, trigger: DiveTrigger): Vec2 {
  if (trigger === "jump" && !player.aimHeld) return { x: 0, y: -1 };
  const angle = Math.round(Math.atan2(player.aimY, player.aimX) / AIM_STEP) * AIM_STEP;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function enterPhase(motion: DiveMotion, phase: DiveMotion["phase"], duration: number): void {
  motion.phase = phase;
  motion.phaseSeconds = 0;
  motion.phaseDuration = duration;
}

/** Ends the active part of a dive: recovery (or a bonk stun), then the cooldown. */
function endDive(motion: DiveMotion, d: DiveTunables, stunSeconds = 0): void {
  motion.bonked = stunSeconds > 0;
  const duration = stunSeconds > 0 ? stunSeconds : d.recoverySeconds;
  enterPhase(motion, "recovery", duration);
  // Refilled mid-dive by a headbutt reset: no extra cooldown after the recovery (headbutt-reset D4).
  motion.cooldown = motion.charged ? duration : duration + d.cooldownSeconds;
}

/**
 * Launch speed: the dive's own, or a roll's speed along the aim when faster, capped (roll carry,
 * double-jump-bash D13). Read before the wind-up slows the blob; falls and blasts never feed it.
 */
function launchSpeedFor(player: PlayerState, direction: Vec2, d: DiveTunables): number {
  if (!isRolling(player)) return d.launchSpeed;
  const along = player.vx * direction.x + player.vy * direction.y;
  return Math.max(d.launchSpeed, Math.min(along, d.rollCarryMax));
}

/**
 * The locked dash direction: the 16-way aim, bent by the aim magnet toward a blob in its cone
 * (owner pick B, dash-aim lap). An aim-less jump dive is a bashing double jump straight up: no
 * magnet (D17).
 */
function aimedDirection(player: PlayerState, start: DiveStart): Vec2 {
  const snapped = diveDirection(player, start.trigger);
  if (start.trigger === "jump" && !player.aimHeld) return snapped;
  const { players, tunables } = start.args;
  return magnetDirection({ dasher: player, snapped, players, tunables });
}

function startWindup(motion: DiveMotion, player: PlayerState, start: DiveStart): void {
  const { d, trigger } = start;
  const direction = aimedDirection(player, start);
  motion.dirX = direction.x;
  motion.dirY = direction.y;
  motion.trigger = trigger;
  motion.launchSpeed = launchSpeedFor(player, direction, d);
  // A dive out of an unlocked roll ends the roll (D12).
  endRoll(player);
  motion.charged = false;
  motion.fireBuffer = 0;
  motion.bonked = false;
  if (Math.abs(direction.x) > 0.1) player.facing = direction.x > 0 ? 1 : -1;
  player.vx *= d.windupSpeedScale;
  player.vy *= d.windupSpeedScale;
  enterPhase(motion, "windup", d.windupSeconds);
}

function launch(motion: DiveMotion, player: PlayerState, d: DiveTunables): void {
  player.vx = motion.dirX * motion.launchSpeed;
  player.vy = motion.dirY * motion.launchSpeed;
  player.grounded = false;
  enterPhase(motion, "travel", d.travelSeconds);
}

// ── Travel ───────────────────────────────────────────────────────────────────

interface TerrainHit {
  axis: "x" | "y";
  /** Direction of the blocked move. */
  direction: -1 | 1;
  /** Speed along the axis before the controller zeroed it. */
  speed: number;
}

/** The step's hardest terrain hit that matters to a dive, or null. */
function terrainHit(player: PlayerState, minSpeed: number): TerrainHit | null {
  const hits: TerrainHit[] = [];
  if (player.terrainHitX !== 0) {
    hits.push({ axis: "x", direction: player.terrainHitX, speed: player.terrainHitSpeedX });
  }
  if (player.terrainHitY !== 0) {
    hits.push({ axis: "y", direction: player.terrainHitY, speed: player.terrainHitSpeedY });
  }
  const hardest = hits.sort((a, b) => b.speed - a.speed)[0];
  return hardest && hardest.speed >= minSpeed ? hardest : null;
}

/**
 * Dash-hold (shared-roll D1, D2): a dive that ends while fire is still held rolls on with its
 * speed instead of recovering. The roll is the player feature's; the dive is idle, cooling down.
 */
function rollOnIfHeld(motion: DiveMotion, player: PlayerState, args: StepDivesArgs): boolean {
  const input = args.inputs?.[player.slot];
  const held = motion.trigger === "jump" ? input?.jump : input?.fire;
  if (held !== true) return false;
  enterPhase(motion, "idle", 0);
  motion.cooldown = motion.charged ? 0 : args.tunables.dive.cooldownSeconds;
  startRoll(player, { source: "dash", holdButton: motion.trigger }, args.tunables);
  return true;
}

/**
 * Terrain ends the dive, never bounces it. Head-on: a bonk (thrown back a little, stunned).
 * Glancing: the controller already stopped the blocked axis; the dive just ends (or rolls on
 * while fire is held). True if it ended.
 */
function endOnTerrain(motion: DiveMotion, player: PlayerState, args: StepDivesArgs): boolean {
  const d = args.tunables.dive;
  const hit = terrainHit(player, d.minTerrainHitSpeed);
  if (!hit) return false;
  const other = hit.axis === "x" ? player.vy : player.vx;
  const headOn = hit.speed / Math.hypot(hit.speed, other) >= d.bonkMinAlignment;
  if (!headOn) {
    if (!rollOnIfHeld(motion, player, args)) endDive(motion, d);
    return true;
  }
  const rebound = -hit.direction * hit.speed * d.bonkRebound;
  player.vx = hit.axis === "x" ? rebound : other * BONK_SLIDE_KEEP;
  player.vy = hit.axis === "y" ? rebound : other * BONK_SLIDE_KEEP;
  endDive(motion, d, d.bonkStunSeconds);
  return true;
}

function stepTravel(motion: DiveMotion, player: PlayerState, args: StepDivesArgs): void {
  const d = args.tunables.dive;
  motion.phaseSeconds += args.dt;
  if (endOnTerrain(motion, player, args)) return;
  if (motion.phaseSeconds < motion.phaseDuration - EPSILON) return;
  // Fire still held: roll on at full dive speed.
  if (rollOnIfHeld(motion, player, args)) return;
  player.vx *= d.exitSpeedScale;
  player.vy *= d.exitSpeedScale;
  endDive(motion, d);
}

// ── Per-player step ──────────────────────────────────────────────────────────

function tickTimers(motion: DiveMotion, dt: number): void {
  motion.cooldown = Math.max(0, motion.cooldown - dt);
  motion.stagger = Math.max(0, motion.stagger - dt);
  motion.sinceRicochet += dt;
  motion.sinceDenied += dt;
}

/** What starts a dive this step, if anything: a buffered fire press, else this step's air press. */
interface DiveStart {
  d: DiveTunables;
  trigger: DiveTrigger;
  /** The step: the other players, for the aim magnet. */
  args: StepDivesArgs;
}

/**
 * Feet on the ground (or just off it, coyote time): the dash is always there (owner, dash-feel
 * lap). The between-dives cooldown and a plain recovery only hold an airborne blob back.
 */
const onFeet = (player: PlayerState): boolean => player.grounded || player.coyoteTimer > 0;

/** The press waits on an event no timer can predict: a landing, a refill, how a dash ends. */
const WAITS_ON_EVENT = "event";

/** Seconds of wind-up and travel still to come. */
const activeSecondsLeft = (motion: DiveMotion, d: DiveTunables): number =>
  motion.phaseDuration - motion.phaseSeconds + (motion.phase === "windup" ? d.travelSeconds : 0);

/**
 * How long until a dive could start: 0 = now, a number of seconds, or `WAITS_ON_EVENT` (airborne
 * with the dive spent, or a dash that ends inside the buffer: a press just before it ends chains
 * the next one). Locks that hold even on the ground: a wall bonk stun, a hit stagger and a locked
 * hit roll.
 */
function secondsUntilReady(
  motion: DiveMotion,
  player: PlayerState,
  d: DiveTunables
): number | typeof WAITS_ON_EVENT {
  if (motion.phase === "windup" || motion.phase === "travel") {
    return activeSecondsLeft(motion, d) <= motion.fireBuffer ? WAITS_ON_EVENT : Infinity;
  }
  const locks = lockSecondsLeft(motion, player);
  // Spent in the air: a landing brings the charge back and waives the cooldown at once.
  if (!motion.charged && !player.grounded) return locks <= EPSILON ? WAITS_ON_EVENT : locks;
  if (onFeet(player)) return Math.max(locks, motion.bonked ? recoveryLeft(motion) : 0);
  return Math.max(locks, recoveryLeft(motion), motion.cooldown);
}

/** Seconds of the current recovery (or bonk stun) still to play; 0 outside one. */
function recoveryLeft(motion: DiveMotion): number {
  return motion.phase === "recovery" ? motion.phaseDuration - motion.phaseSeconds : 0;
}

/** Seconds of the locks that hold a blob back even on its feet: hit stagger, locked hit roll. */
function lockSecondsLeft(motion: DiveMotion, player: PlayerState): number {
  return Math.max(motion.stagger, isRollLocked(player) ? player.rollLockSeconds : 0);
}

const diveReady = (motion: DiveMotion, player: PlayerState, d: DiveTunables): boolean => {
  const wait = secondsUntilReady(motion, player, d);
  return wait !== WAITS_ON_EVENT && wait <= EPSILON;
};

/**
 * The trigger that may start a dive now. A jump request is never buffered: it starts on the step
 * it is read, in the air only, or is denied, so a landing jump never turns into a ground dive
 * (double-jump-bash A5). A rolling blob may dive once its roll is unlocked (D12).
 */
function readyTrigger(
  motion: DiveMotion,
  player: PlayerState,
  ctx: { d: DiveTunables; jumpRequest: boolean }
): DiveTrigger | null {
  const { jumpRequest } = ctx;
  if (!diveReady(motion, player, ctx.d)) return null;
  if (motion.fireBuffer > 0) return "fire";
  return jumpRequest && !player.grounded ? "jump" : null;
}

/** A press that cannot start a dive: the "denied" moment (head shake + sound, dash-feel lap). */
function deny(dive: DiveState, motion: DiveMotion, player: PlayerState): void {
  motion.fireBuffer = 0;
  motion.sinceDenied = 0;
  dive.deniedCounts[player.id] = (dive.deniedCounts[player.id] ?? 0) + 1;
}

/**
 * After the start check: a fire press still waiting is kept while the dive will be ready inside
 * what is left of the buffer (or a landing may refill it), else denied at once; a buffer that runs
 * out unused is denied too. An air jump press that did not start a dive is denied on the spot.
 */
function holdOrDenyPress(
  motion: DiveMotion,
  player: PlayerState,
  ctx: { args: StepDivesArgs; jumpRequest: boolean; started: boolean }
): void {
  const { args, started } = ctx;
  if (started) return;
  if (ctx.jumpRequest && !player.grounded && motion.fireBuffer <= 0) {
    deny(args.dive, motion, player);
    return;
  }
  if (motion.fireBuffer <= 0) return;
  const wait = secondsUntilReady(motion, player, args.tunables.dive);
  motion.fireBuffer = Math.max(0, motion.fireBuffer - args.dt);
  const expired = motion.fireBuffer <= EPSILON;
  const tooLong = wait !== WAITS_ON_EVENT && wait > motion.fireBuffer + EPSILON;
  if (expired || tooLong) deny(args.dive, motion, player);
}

/** True once per new air jump press the controller counted (double-jump-bash D3). */
function readJumpRequest(dive: DiveState, player: PlayerState): boolean {
  const read = dive.airJumpPressesRead[player.id] ?? player.airJumpPressCount;
  dive.airJumpPressesRead[player.id] = player.airJumpPressCount;
  return player.airJumpPressCount > read;
}

/** A phase that ran out hands over on the same step. */
function handOverPhase(motion: DiveMotion, player: PlayerState, d: DiveTunables): void {
  if (motion.phaseSeconds < motion.phaseDuration - EPSILON) return;
  if (motion.phase === "windup") launch(motion, player, d);
  else if (motion.phase === "recovery") {
    enterPhase(motion, "idle", 0);
    motion.bonked = false;
  }
}

function stepPhase(motion: DiveMotion, player: PlayerState, args: StepDivesArgs): void {
  const d = args.tunables.dive;
  const jumpRequest = readJumpRequest(args.dive, player);
  tickTimers(motion, args.dt);
  const active = motion.phase === "windup" || motion.phase === "travel";
  if (player.grounded && !active) motion.charged = true;
  // Idle, or a recovery the blob may cut short (on its feet, not bonked): a press can start here.
  const started = !active && startIfReady(motion, player, { d, jumpRequest, args });
  if (motion.phase === "travel") stepTravel(motion, player, args);
  else if (!started && motion.phase !== "idle") motion.phaseSeconds += args.dt;
  handOverPhase(motion, player, d);
  holdOrDenyPress(motion, player, { args, jumpRequest, started });
}

/** Starts the wind-up when a press is waiting and the dive is ready; true if it started. */
function startIfReady(
  motion: DiveMotion,
  player: PlayerState,
  ctx: { d: DiveTunables; jumpRequest: boolean; args: StepDivesArgs }
): boolean {
  const trigger = readyTrigger(motion, player, ctx);
  if (trigger) startWindup(motion, player, { d: ctx.d, trigger, args: ctx.args });
  return trigger !== null;
}

interface MotionModifiers {
  steer: number;
  gravity: number;
  jumpLocked: boolean;
}

/** What the dive phase asks of the controller. */
function phaseModifiers(motion: DiveMotion, d: DiveTunables): MotionModifiers {
  switch (motion.phase) {
    case "windup":
      return { steer: 0, gravity: d.windupGravityScale, jumpLocked: true };
    case "travel":
      return { steer: 0, gravity: 0, jumpLocked: true };
    case "recovery":
      return { steer: motion.bonked ? 0 : d.recoverySteerScale, gravity: 1, jumpLocked: true };
    default:
      return { steer: 1, gravity: 1, jumpLocked: false };
  }
}

/** Writes the controller's motion modifiers for the next step from the dive phase. */
function writeModifiers(motion: DiveMotion, player: PlayerState, d: DiveTunables): void {
  const modifiers = phaseModifiers(motion, d);
  const staggerSteer = motion.stagger > 0 ? d.staggerSteerScale : 1;
  player.steerScale = Math.min(modifiers.steer, staggerSteer);
  player.gravityScale = modifiers.gravity;
  player.jumpLocked = modifiers.jumpLocked;
}

// ── Hits ─────────────────────────────────────────────────────────────────────

interface Strike {
  attacker: PlayerState;
  victim: PlayerState;
  /** Unit vector attacker → victim. */
  direction: Vec2;
  contact: BodyContact;
}

/** The strikes in one contact: each side that was diving toward the other. */
function strikesIn(contact: BodyContact, args: StepDivesArgs): Strike[] {
  const { a, b, normal } = contact;
  const sides: (Strike & { approach: number })[] = [
    { attacker: a, victim: b, direction: normal, contact, approach: contact.aApproachSpeed },
    {
      attacker: b,
      victim: a,
      direction: { x: -normal.x, y: -normal.y },
      contact,
      approach: contact.bApproachSpeed,
    },
  ];
  // A hit ends the attacker's dive, so one dive lands at most one hit per step it travels.
  return sides.filter(
    ({ attacker, approach }) =>
      motionOf(args.dive, attacker).phase === "travel" && approach >= args.tunables.dive.minHitSpeed
  );
}

/** The ricochet: whatever speed the collision left the attacker, it pops straight up. */
function ricochet(strike: Strike, d: DiveTunables): void {
  strike.attacker.vy = -d.attackerPop;
  strike.attacker.grounded = false;
}

/**
 * A landed headbutt pushes the victim like a direct rocket hit (`directHitPush`, owner,
 * bash-matches-rocket lap): away from the impact, added to how it was already moving. The body
 * collision already exchanged momentum; that exchange is replaced by the push, except that a
 * victim the collision bounced back (a head-on clash) keeps that bounce up to the push. Returns the
 * velocity change it gave (the hurt reaction's, as for a blast).
 */
function knockVictim(strike: Strike, push: number): Vec2 {
  const { victim, direction, contact } = strike;
  const exchange = victim === contact.a ? contact.aImpulse : contact.bImpulse;
  const along = victim.vx * direction.x + victim.vy * direction.y;
  const before = along - exchange;
  const leave = Math.max(before + push, Math.min(along, push));
  victim.vx += direction.x * (leave - along);
  victim.vy += direction.y * (leave - along);
  victim.grounded = false;
  const given = leave - before;
  return { x: direction.x * given, y: direction.y * given };
}

/** Applies one strike's push on the victim and returns its hit event. */
function applyStrike(strike: Strike, args: StepDivesArgs): DiveHit {
  const { attacker, victim, direction, contact } = strike;
  const impulse = knockVictim(strike, directHitPush(args.tunables));
  // Damage, spawn protection, credit and the `playerHit` event are combat's.
  const hit = {
    victimSlot: victim.slot,
    attackerSlot: attacker.slot,
    kind: "contact",
    source: "dive",
    contactPoint: contact.at,
    direction,
  } as const;
  const result = applyHit(args, hit);
  // The victim rolls as long as the push says, like a blast victim.
  reactToHit(victim, { impulse }, args.tunables);
  return { ...hit, ...result, impulse };
}

/** What a landed hit does to both dive states. */
function settleHit(strike: Strike, strikers: ReadonlySet<string>, args: StepDivesArgs): void {
  const d = args.tunables.dive;
  const attackerMotion = motionOf(args.dive, strike.attacker);
  const victimMotion = motionOf(args.dive, strike.victim);
  // The attacker's dive is over and ready again at once: chains off other blobs.
  enterPhase(attackerMotion, "idle", 0);
  attackerMotion.cooldown = 0;
  attackerMotion.charged = true;
  attackerMotion.sinceRicochet = 0;
  victimMotion.stagger = d.staggerSeconds;
  // A victim caught mid-dive loses it, unless it struck back in this same contact (a clash).
  const victimDiving = victimMotion.phase === "windup" || victimMotion.phase === "travel";
  if (victimDiving && !strikers.has(strike.victim.id)) endDive(victimMotion, d);
}

/** Turns this step's body contacts into hits. Both sides of a clash are judged before either moves. */
function resolveHits(args: StepDivesArgs): DiveHit[] {
  // Touches, plus near passes inside the dash hit reach when it is above the body width (option A).
  const contacts = [...args.contacts, ...resolveReachContacts(args)];
  const strikes = contacts.flatMap((contact) => strikesIn(contact, args));
  const strikers = new Set(strikes.map((strike) => strike.attacker.id));
  // Ricochets first, pushes second: in a clash both divers end up with the same velocity.
  strikes.forEach((strike) => ricochet(strike, args.tunables.dive));
  const hits = strikes.map((strike) => applyStrike(strike, args));
  strikes.forEach((strike) => settleHit(strike, strikers, args));
  for (const hit of hits) args.dive.recentHits.push({ hit, ageSeconds: 0 });
  return hits;
}

function ageRecentHits(dive: DiveState, dt: number): void {
  for (const recent of dive.recentHits) recent.ageSeconds += dt;
  dive.recentHits = dive.recentHits.filter((recent) => recent.ageSeconds < RECENT_HIT_SECONDS);
}

/**
 * Advances every player's dive one fixed step and returns the hits landed on it (also kept in
 * `dive.hits` until the next step). Mutates `dive` and the players in place.
 */
export function stepDives(args: StepDivesArgs): DiveHit[] {
  const { dive, players } = args;
  ageRecentHits(dive, args.dt);
  dive.hits = resolveHits(args);
  for (const player of players) {
    const motion = motionOf(dive, player);
    stepPhase(motion, player, args);
    writeModifiers(motion, player, args.tunables.dive);
  }
  return dive.hits;
}
