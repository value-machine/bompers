import type { DiveOptionTunables, GameTunables } from "@/shared/types/gameTunables.types";
import type { PlayerInput, PlayerInputs } from "@/shared/types/gameInput.types";
import type { Vec2 } from "@/shared/types/gameGeometry.types";
import { EMPTY_PLAYER_INPUT } from "@/shared/utils/gameInputMapping";
import type { BodyContact, PlayerState } from "@/features/player/api/playerApi";
import type { DiveHit, DiveMotion, DiveState, HitTally } from "@/features/dive/types/dive.types";
import { classifyHitZone, hitDamage } from "@/features/dive/services/hitZone";

/**
 * Dive headbutt system (sim step 3a, after players and body contacts, before combat). Fire
 * makes the blob dive headfirst along its aim: idle → wind-up → travel → recovery. A body
 * contact while travelling toward someone is a hit: the body collision already exchanged the
 * momentum; the dive adds its strike, classifies the zone and emits a `DiveHit`.
 *
 * The dive never moves a player itself. It writes velocity at events (launch, bounce, strike)
 * and the controller's motion modifiers (`steerScale`, `gravityScale`, `jumpLocked`) each step.
 * One state machine; a variant is a `DiveOptionTunables` set.
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

/** Seconds a landed hit stays in `recentHits` for the impact effect. */
const RECENT_HIT_SECONDS = 0.25;
/** Timer comparisons tolerate float drift so durations land on whole steps. */
const EPSILON = 1e-9;
/** Share of the sideways speed kept on a head-on terrain bonk. */
const BONK_SLIDE_KEEP = 0.3;

export const createDiveState = (): DiveState => ({
  optionIndex: 0,
  motions: {},
  tallies: {},
  hits: [],
  recentHits: [],
});

const createDiveMotion = (): DiveMotion => ({
  phase: "idle",
  phaseSeconds: 0,
  phaseDuration: 0,
  dirX: 1,
  dirY: 0,
  bouncesLeft: 0,
  charged: true,
  cooldown: 0,
  fireBuffer: 0,
  prevFire: false,
  prevJump: false,
  hitVictimIds: [],
  bonked: false,
  stagger: 0,
});

const createTally = (): HitTally => ({ dealt: 0, frontTaken: 0, backTaken: 0, damageTaken: 0 });

/** The option being played (clamped, so a bad index never crashes the sim). */
export function activeDiveOption(dive: DiveState, tunables: GameTunables): DiveOptionTunables {
  const { options } = tunables.dive;
  const index = Math.min(Math.max(dive.optionIndex, 0), options.length - 1);
  const option = options[index];
  if (!option) throw new Error("tunables.dive.options is empty");
  return option;
}

/** Switches the played option and puts every dive back to idle (prototype keys 1 / 2 / 3). */
export function selectDiveOption(dive: DiveState, index: number, tunables: GameTunables): void {
  if (index < 0 || index >= tunables.dive.options.length) return;
  dive.optionIndex = index;
  for (const id of Object.keys(dive.motions)) dive.motions[id] = createDiveMotion();
}

function motionOf(dive: DiveState, player: PlayerState): DiveMotion {
  return (dive.motions[player.id] ??= createDiveMotion());
}

const tallyOf = (dive: DiveState, id: string): HitTally => (dive.tallies[id] ??= createTally());

// ── Phase changes ────────────────────────────────────────────────────────────

/** Unit dive direction from the player's aim, optionally snapped to 8 ways. */
function diveDirection(player: PlayerState, option: DiveOptionTunables): Vec2 {
  if (!option.aimSnap8) return { x: player.aimX, y: player.aimY };
  const step = Math.PI / 4;
  const angle = Math.round(Math.atan2(player.aimY, player.aimX) / step) * step;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function enterPhase(motion: DiveMotion, phase: DiveMotion["phase"], duration: number): void {
  motion.phase = phase;
  motion.phaseSeconds = 0;
  motion.phaseDuration = duration;
}

/** Ends the active part of a dive: recovery (or a longer stun), then the cooldown. */
function endDive(motion: DiveMotion, option: DiveOptionTunables, stunSeconds = 0): void {
  motion.bonked = stunSeconds > 0;
  const duration = stunSeconds > 0 ? stunSeconds : option.recoverySeconds;
  enterPhase(motion, "recovery", duration);
  motion.cooldown = duration + option.cooldownSeconds;
}

function startWindup(motion: DiveMotion, player: PlayerState, option: DiveOptionTunables): void {
  const direction = diveDirection(player, option);
  motion.dirX = direction.x;
  motion.dirY = direction.y;
  motion.charged = false;
  motion.fireBuffer = 0;
  motion.hitVictimIds = [];
  motion.bouncesLeft = option.terrainBounces;
  motion.bonked = false;
  if (Math.abs(direction.x) > 0.1) player.facing = direction.x > 0 ? 1 : -1;
  player.vx *= option.windupSpeedScale;
  player.vy *= option.windupSpeedScale;
  enterPhase(motion, "windup", option.windupSeconds);
}

function launch(motion: DiveMotion, player: PlayerState, option: DiveOptionTunables): void {
  player.vx = player.vx * option.launchCarry + motion.dirX * option.launchSpeed;
  player.vy = player.vy * option.launchCarry + motion.dirY * option.launchSpeed;
  const speed = Math.hypot(player.vx, player.vy);
  if (speed > option.maxSpeed) {
    player.vx *= option.maxSpeed / speed;
    player.vy *= option.maxSpeed / speed;
  }
  player.grounded = false;
  enterPhase(motion, "travel", option.travelSeconds);
}

// ── Travel ───────────────────────────────────────────────────────────────────

interface TerrainHit {
  axis: "x" | "y";
  /** Direction of the blocked move. */
  direction: -1 | 1;
  /** Speed along the axis before the controller zeroed it. */
  speed: number;
}

/** The step's terrain hits that are hard enough to matter to a dive. */
function terrainHits(player: PlayerState, minSpeed: number): TerrainHit[] {
  const hits: TerrainHit[] = [];
  if (player.terrainHitX !== 0 && player.terrainHitSpeedX >= minSpeed) {
    hits.push({ axis: "x", direction: player.terrainHitX, speed: player.terrainHitSpeedX });
  }
  if (player.terrainHitY !== 0 && player.terrainHitSpeedY >= minSpeed) {
    hits.push({ axis: "y", direction: player.terrainHitY, speed: player.terrainHitSpeedY });
  }
  return hits;
}

const setAxisSpeed = (player: PlayerState, axis: "x" | "y", value: number): void => {
  if (axis === "x") player.vx = value;
  else player.vy = value;
};

/**
 * A diver meeting terrain: bounce while bounces are left; else a head-on hit stuns ("bonk") when
 * the option has a stun; else nothing (the controller already stopped that axis: it slides).
 * Returns true when the dive ended.
 */
function reactToTerrain(
  motion: DiveMotion,
  player: PlayerState,
  ctx: { option: DiveOptionTunables; minSpeed: number }
): boolean {
  const { option } = ctx;
  for (const hit of terrainHits(player, ctx.minSpeed)) {
    if (motion.bouncesLeft > 0) {
      motion.bouncesLeft -= 1;
      setAxisSpeed(player, hit.axis, -hit.direction * hit.speed * option.terrainRestitution);
      if (hit.axis === "y") player.grounded = false;
      continue;
    }
    const other = hit.axis === "x" ? player.vy : player.vx;
    const alignment = hit.speed / Math.hypot(hit.speed, other);
    if (option.bonkStunSeconds > 0 && alignment >= option.bonkMinAlignment) {
      setAxisSpeed(player, hit.axis, -hit.direction * hit.speed * option.bonkRebound);
      setAxisSpeed(player, hit.axis === "x" ? "y" : "x", other * BONK_SLIDE_KEEP);
      endDive(motion, option, option.bonkStunSeconds);
      return true;
    }
  }
  return false;
}

/** Jump pressed inside the option's cancel window: the dive ends at once, jump is free again. */
function tryJumpCancel(motion: DiveMotion, jumpPressed: boolean, option: DiveOptionTunables) {
  const after = option.jumpCancelAfterSeconds;
  if (after === null || !jumpPressed || motion.phaseSeconds < after - EPSILON) return false;
  enterPhase(motion, "idle", 0);
  motion.cooldown = option.cooldownSeconds;
  return true;
}

/** Ends the travel when it lands with no bounce left, or when its time is up. True if it ended. */
function finishTravel(motion: DiveMotion, player: PlayerState, option: DiveOptionTunables) {
  if (option.endOnGround && motion.bouncesLeft === 0 && player.grounded) {
    endDive(motion, option);
    return true;
  }
  if (motion.phaseSeconds < motion.phaseDuration - EPSILON) return false;
  player.vx *= option.exitSpeedScale;
  player.vy *= option.exitSpeedScale;
  endDive(motion, option);
  return true;
}

/** Drag on the dive speed; the dive direction follows the velocity (bounces turn it). */
function applyTravelDrag(motion: DiveMotion, player: PlayerState, decay: number): void {
  player.vx *= decay;
  player.vy *= decay;
  const speed = Math.hypot(player.vx, player.vy);
  if (speed <= 1) return;
  motion.dirX = player.vx / speed;
  motion.dirY = player.vy / speed;
}

function stepTravel(
  motion: DiveMotion,
  player: PlayerState,
  ctx: { option: DiveOptionTunables; minSpeed: number; jumpPressed: boolean; dt: number }
): void {
  const { option, dt } = ctx;
  motion.phaseSeconds += dt;
  if (reactToTerrain(motion, player, ctx)) return;
  if (tryJumpCancel(motion, ctx.jumpPressed, option)) return;
  if (finishTravel(motion, player, option)) return;
  applyTravelDrag(motion, player, Math.exp(-option.travelDrag * dt));
}

// ── Per-player step ──────────────────────────────────────────────────────────

function tickTimers(motion: DiveMotion, input: PlayerInput, args: StepDivesArgs): void {
  const { dt, tunables } = args;
  motion.cooldown = Math.max(0, motion.cooldown - dt);
  motion.fireBuffer = Math.max(0, motion.fireBuffer - dt);
  motion.stagger = Math.max(0, motion.stagger - dt);
  if (input.fire && !motion.prevFire) motion.fireBuffer = tunables.dive.fireBufferSeconds;
}

const canStartDive = (motion: DiveMotion): boolean =>
  motion.fireBuffer > 0 && motion.cooldown <= EPSILON && motion.charged && motion.stagger <= 0;

/** A phase that ran out hands over on the same step (a 0-second wind-up launches at once). */
function handOverPhase(motion: DiveMotion, player: PlayerState, option: DiveOptionTunables) {
  if (motion.phaseSeconds < motion.phaseDuration - EPSILON) return;
  if (motion.phase === "windup") launch(motion, player, option);
  else if (motion.phase === "recovery") {
    enterPhase(motion, "idle", 0);
    motion.bonked = false;
  }
}

function advancePhase(
  motion: DiveMotion,
  player: PlayerState,
  ctx: { option: DiveOptionTunables; minSpeed: number; jumpPressed: boolean; dt: number }
): void {
  if (motion.phase === "travel") stepTravel(motion, player, ctx);
  else if (motion.phase !== "idle") motion.phaseSeconds += ctx.dt;
  else if (canStartDive(motion)) startWindup(motion, player, ctx.option);
  handOverPhase(motion, player, ctx.option);
}

function stepPhase(motion: DiveMotion, player: PlayerState, args: StepDivesArgs): void {
  const option = activeDiveOption(args.dive, args.tunables);
  const input = args.inputs[player.slot] ?? EMPTY_PLAYER_INPUT;
  const jumpPressed = input.jump && !motion.prevJump;
  tickTimers(motion, input, args);
  const active = motion.phase === "windup" || motion.phase === "travel";
  if (player.grounded && !active) motion.charged = true;
  const minSpeed = args.tunables.dive.minTerrainHitSpeed;
  advancePhase(motion, player, { option, minSpeed, jumpPressed, dt: args.dt });
  motion.prevFire = input.fire;
  motion.prevJump = input.jump;
}

interface MotionModifiers {
  steer: number;
  gravity: number;
  jumpLocked: boolean;
}

/** What the dive phase asks of the controller. */
function phaseModifiers(motion: DiveMotion, option: DiveOptionTunables): MotionModifiers {
  switch (motion.phase) {
    case "windup":
      return { steer: 0, gravity: option.windupGravityScale, jumpLocked: true };
    case "travel":
      return {
        steer: option.travelSteerScale,
        gravity: option.travelGravityScale,
        jumpLocked: true,
      };
    case "recovery":
      return {
        steer: motion.bonked ? 0 : option.recoverySteerScale,
        gravity: 1,
        jumpLocked: motion.bonked || option.recoveryLocksJump,
      };
    default:
      return { steer: 1, gravity: 1, jumpLocked: false };
  }
}

/** Writes the controller's motion modifiers for the next step from the dive phase. */
function writeModifiers(motion: DiveMotion, player: PlayerState, args: StepDivesArgs): void {
  const modifiers = phaseModifiers(motion, activeDiveOption(args.dive, args.tunables));
  const staggerSteer = motion.stagger > 0 ? args.tunables.dive.staggerSteerScale : 1;
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
  return sides.filter(({ attacker, victim, approach }) => {
    const motion = motionOf(args.dive, attacker);
    return (
      motion.phase === "travel" &&
      approach >= args.tunables.dive.minHitSpeed &&
      !motion.hitVictimIds.includes(victim.id)
    );
  });
}

/** Applies one strike's push and returns its hit event. */
function applyStrike(strike: Strike, args: StepDivesArgs): DiveHit {
  const { attacker, victim, direction, contact } = strike;
  const { dive, tunables } = args;
  const option = activeDiveOption(dive, tunables);
  const zone = classifyHitZone(direction, victim.facing, tunables.dive);
  const push = option.strikeImpulse;
  victim.vx += direction.x * push;
  victim.vy += direction.y * push - option.strikeLift;
  victim.grounded = false;
  attacker.vx -= direction.x * push * option.attackerRebound;
  attacker.vy -= direction.y * push * option.attackerRebound;
  if (option.attackerPop > 0) attacker.vy = -option.attackerPop;
  const total = contact.impulse + push;
  return {
    attackerId: attacker.id,
    victimId: victim.id,
    zone,
    damage: hitDamage(zone, tunables.dive),
    impulse: { x: direction.x * total, y: direction.y * total - option.strikeLift },
    at: contact.at,
  };
}

/** What a landed hit does to both dive states. */
function settleHit(strike: Strike, strikers: ReadonlySet<string>, args: StepDivesArgs): void {
  const option = activeDiveOption(args.dive, args.tunables);
  const attackerMotion = motionOf(args.dive, strike.attacker);
  const victimMotion = motionOf(args.dive, strike.victim);
  attackerMotion.hitVictimIds.push(strike.victim.id);
  if (option.refreshOnHit) {
    enterPhase(attackerMotion, "idle", 0);
    attackerMotion.cooldown = 0;
    attackerMotion.charged = true;
  } else {
    endDive(attackerMotion, option);
  }
  victimMotion.stagger = args.tunables.dive.staggerSeconds;
  // A victim caught mid-dive loses it, unless it struck back in this same contact (a clash).
  const victimDiving = victimMotion.phase === "windup" || victimMotion.phase === "travel";
  if (victimDiving && !strikers.has(strike.victim.id)) endDive(victimMotion, option);
}

function recordHit(dive: DiveState, hit: DiveHit): void {
  const victim = tallyOf(dive, hit.victimId);
  tallyOf(dive, hit.attackerId).dealt += 1;
  if (hit.zone === "back") victim.backTaken += 1;
  else victim.frontTaken += 1;
  victim.damageTaken += hit.damage;
  dive.recentHits.push({ hit, ageSeconds: 0 });
}

/** Turns this step's body contacts into hits. Both sides of a clash are judged before either moves. */
function resolveHits(args: StepDivesArgs): DiveHit[] {
  const strikes = args.contacts.flatMap((contact) => strikesIn(contact, args));
  const strikers = new Set(strikes.map((strike) => strike.attacker.id));
  const hits = strikes.map((strike) => applyStrike(strike, args));
  strikes.forEach((strike) => settleHit(strike, strikers, args));
  hits.forEach((hit) => recordHit(args.dive, hit));
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
    writeModifiers(motion, player, args);
  }
  return dive.hits;
}
