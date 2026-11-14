import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { PlayerInput, PlayerInputs } from "@/shared/types/gameInput.types";
import type { Vec2 } from "@/shared/types/gameGeometry.types";
import { EMPTY_PLAYER_INPUT } from "@/shared/utils/gameInputMapping";
import type { BodyContact, PlayerState } from "@/features/player/api/playerApi";
import type { DiveHit, DiveMotion, DiveState } from "@/features/dive/types/dive.types";
import { classifyHitZone, hitDamage } from "@/features/dive/services/hitZone";

/**
 * Dive headbutt system (sim step 3a, after players and body contacts). Fire makes the blob dive
 * headfirst along its 8-way aim: idle → wind-up (hang and crouch) → travel (dead straight, no
 * gravity, no steering) → recovery. Terrain always ends the dive: a head-on hit is a short stun
 * ("bonk"), a glancing one a plain recovery; it never bounces. A body contact while travelling
 * toward someone is a hit: the body collision already exchanged the momentum; the dive adds
 * its strike, ricochets the attacker up with the dive ready again, and emits a `DiveHit`.
 *
 * The dive never moves a player itself. It writes velocity at events (launch, bonk, strike)
 * and the controller's motion modifiers (`steerScale`, `gravityScale`, `jumpLocked`) each step.
 */
export interface StepDivesArgs {
  dive: DiveState;
  players: PlayerState[];
  inputs: PlayerInputs;
  /** This step's blob-vs-blob contacts (`resolveBodyContacts`). */
  contacts: readonly BodyContact[];
  tunables: GameTunables;
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
/** The aim is snapped to 8 directions so the dive line is always readable. */
const AIM_STEP = Math.PI / 4;

export const createDiveState = (): DiveState => ({ motions: {}, hits: [], recentHits: [] });

const createDiveMotion = (): DiveMotion => ({
  phase: "idle",
  phaseSeconds: 0,
  phaseDuration: 0,
  dirX: 1,
  dirY: 0,
  charged: true,
  cooldown: 0,
  fireBuffer: 0,
  prevFire: false,
  bonked: false,
  stagger: 0,
  sinceRicochet: Number.POSITIVE_INFINITY,
});

function motionOf(dive: DiveState, player: PlayerState): DiveMotion {
  return (dive.motions[player.id] ??= createDiveMotion());
}

// ── Phase changes ────────────────────────────────────────────────────────────

/** Unit dive direction: the player's aim snapped to 8 ways. */
function diveDirection(player: PlayerState): Vec2 {
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
  motion.cooldown = duration + d.cooldownSeconds;
}

function startWindup(motion: DiveMotion, player: PlayerState, d: DiveTunables): void {
  const direction = diveDirection(player);
  motion.dirX = direction.x;
  motion.dirY = direction.y;
  motion.charged = false;
  motion.fireBuffer = 0;
  motion.bonked = false;
  if (Math.abs(direction.x) > 0.1) player.facing = direction.x > 0 ? 1 : -1;
  player.vx *= d.windupSpeedScale;
  player.vy *= d.windupSpeedScale;
  enterPhase(motion, "windup", d.windupSeconds);
}

function launch(motion: DiveMotion, player: PlayerState, d: DiveTunables): void {
  player.vx = motion.dirX * d.launchSpeed;
  player.vy = motion.dirY * d.launchSpeed;
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
 * Terrain ends the dive, never bounces it. Head-on: a bonk (thrown back a little, stunned).
 * Glancing: the controller already stopped the blocked axis; the dive just ends. True if it ended.
 */
function endOnTerrain(motion: DiveMotion, player: PlayerState, d: DiveTunables): boolean {
  const hit = terrainHit(player, d.minTerrainHitSpeed);
  if (!hit) return false;
  const other = hit.axis === "x" ? player.vy : player.vx;
  const headOn = hit.speed / Math.hypot(hit.speed, other) >= d.bonkMinAlignment;
  if (!headOn) {
    endDive(motion, d);
    return true;
  }
  const rebound = -hit.direction * hit.speed * d.bonkRebound;
  player.vx = hit.axis === "x" ? rebound : other * BONK_SLIDE_KEEP;
  player.vy = hit.axis === "y" ? rebound : other * BONK_SLIDE_KEEP;
  endDive(motion, d, d.bonkStunSeconds);
  return true;
}

function stepTravel(motion: DiveMotion, player: PlayerState, ctx: { d: DiveTunables; dt: number }) {
  const { d } = ctx;
  motion.phaseSeconds += ctx.dt;
  if (endOnTerrain(motion, player, d)) return;
  if (motion.phaseSeconds < motion.phaseDuration - EPSILON) return;
  player.vx *= d.exitSpeedScale;
  player.vy *= d.exitSpeedScale;
  endDive(motion, d);
}

// ── Per-player step ──────────────────────────────────────────────────────────

function tickTimers(motion: DiveMotion, input: PlayerInput, args: StepDivesArgs): void {
  const { dt, tunables } = args;
  motion.cooldown = Math.max(0, motion.cooldown - dt);
  motion.fireBuffer = Math.max(0, motion.fireBuffer - dt);
  motion.stagger = Math.max(0, motion.stagger - dt);
  motion.sinceRicochet += dt;
  if (input.fire && !motion.prevFire) motion.fireBuffer = tunables.dive.fireBufferSeconds;
  motion.prevFire = input.fire;
}

const canStartDive = (motion: DiveMotion): boolean =>
  motion.fireBuffer > 0 && motion.cooldown <= EPSILON && motion.charged && motion.stagger <= 0;

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
  tickTimers(motion, args.inputs[player.slot] ?? EMPTY_PLAYER_INPUT, args);
  const active = motion.phase === "windup" || motion.phase === "travel";
  if (player.grounded && !active) motion.charged = true;
  if (motion.phase === "travel") stepTravel(motion, player, { d, dt: args.dt });
  else if (motion.phase !== "idle") motion.phaseSeconds += args.dt;
  else if (canStartDive(motion)) startWindup(motion, player, d);
  handOverPhase(motion, player, d);
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

/** Applies one strike's push on the victim and returns its hit event. */
function applyStrike(strike: Strike, args: StepDivesArgs): DiveHit {
  const { attacker, victim, direction, contact } = strike;
  const d = args.tunables.dive;
  const zone = classifyHitZone(victim.facing, direction);
  const push = d.strikeImpulse;
  victim.vx += direction.x * push;
  victim.vy += direction.y * push - d.strikeLift;
  victim.grounded = false;
  const total = contact.impulse + push;
  return {
    victimSlot: victim.slot,
    attackerSlot: attacker.slot,
    kind: "contact",
    source: "dive",
    contactPoint: contact.at,
    direction,
    zone,
    damage: hitDamage(zone, d),
    impulse: { x: direction.x * total, y: direction.y * total - d.strikeLift },
  };
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
  const strikes = args.contacts.flatMap((contact) => strikesIn(contact, args));
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
