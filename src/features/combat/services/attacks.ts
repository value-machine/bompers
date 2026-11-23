import type { PlayerInputs } from "@/shared/types/gameInput.types";
import type { SprayWeaponItemId } from "@/shared/types/weaponItems.types";
import { resolveBeamClashes } from "@/shared/utils/beamClash";
import { terrainBodies } from "@/features/arena/api/arenaApi";
import { weaponAim, type PlayerState } from "@/features/player/api/playerApi";
import {
  emitCombatEvent,
  fighterFor,
  type CombatContext,
} from "@/features/combat/services/combatState";
import { helmetPoint } from "@/features/combat/services/combatGeometry";
import { fireRocket } from "@/features/combat/services/rockets";
import {
  isProjectileWeapon,
  rocketKindOf,
  sprayBeamOf,
  weaponTunables,
} from "@/features/combat/services/weapons";
import type { FighterState } from "@/features/combat/types/combat.types";

/**
 * The fire button (GDD § 3). Projectile weapons act once per press: they shoot their rocket kind,
 * then wait out that weapon's cooldown. Spray weapons (the torch) act on every step the button is
 * held: they call the `sprayAttack` hook and drain `dt` seconds of fuel (fire-spread b1, D6).
 * Unarmed players go to the `unarmedAttack` hook on a press. Without a hook, that fire does nothing.
 */
export interface UnarmedFirePress {
  ctx: CombatContext;
  attacker: PlayerState;
  fighter: FighterState;
}

/**
 * Slot for the unarmed attack (the dive headbutt / "bomp" lap fills it): called once per fire
 * press of a non-eliminated, unarmed player. Deal damage through `applyHit` (`services/combatState.ts`)
 * with `kind: "contact"`, `source: "dive"`; cooldowns are the hook's own.
 */
export type UnarmedAttackHook = (press: UnarmedFirePress) => void;

/** One held step of a spray weapon: who sprays, with which weapon and for how long (seconds). */
export interface SprayStep extends UnarmedFirePress {
  itemId: SprayWeaponItemId;
  dt: number;
  /**
   * How far the beam goes this step, world units: the weapon's own length, or less when a beam
   * of a reacting element ends it (beam-clash D1). The hook must not act past it.
   */
  reach: number;
}

/**
 * Slot for spray weapons (match fills it with the torch and the freeze ray, by `itemId`): called
 * on every step a non-eliminated player holds fire with a spray weapon that has fuel left.
 * Combat drains the fuel.
 */
export type SprayAttackHook = (step: SprayStep) => void;

export interface StepAttacksOptions {
  dt: number;
  unarmedAttack?: UnarmedAttackHook;
  sprayAttack?: SprayAttackHook;
  /**
   * Sprayers the spray's recoil does not move (match: a seated driver, a diving blob;
   * spray-recoil D4). Omitted: every sprayer feels it.
   */
  steadyShooter?: (shooter: PlayerState) => boolean;
}

/** Below this much fuel (seconds) a spray weapon counts as empty: float drain never hits 0 exactly. */
const EMPTY_FUEL = 1e-6;

function firePress(press: UnarmedFirePress, unarmedAttack: UnarmedAttackHook | undefined): void {
  const { ctx, attacker, fighter } = press;
  const weapon = fighter.weapon;
  if (!weapon) {
    unarmedAttack?.(press);
    return;
  }
  if (!isProjectileWeapon(weapon.itemId)) return;
  fireRocket(ctx, attacker, rocketKindOf(weapon.itemId));
  weapon.ammo -= 1;
  if (weapon.ammo <= 0) fighter.weapon = null;
  fighter.attackCooldown = weaponTunables(ctx.tunables, weapon.itemId).fireCooldown;
}

/** Velocity `delta` added along `dir` (−1 / 1), but only up to `cap` units / s along it. */
const pushUpTo = (velocity: number, delta: number, cap: number): number => {
  const dir = Math.sign(delta);
  return dir * Math.min(Math.abs(delta), Math.max(0, cap - velocity * dir));
};

/**
 * Spray recoil (owner, spray-recoil D1–D4), the one mechanism for every spray weapon: while fire
 * is held the holder is thrust opposite the aim at the weapon's `recoil` (units / s²) — the
 * held counterpart of a rocket's per-shot kick. Aimed down it lifts the blob a little, aimed
 * sideways it pushes it back. Two shared limits keep it a hop, never flight: the speed it may
 * add between two touches of the ground (`sprayRecoil.airBudget`, refilled while grounded), and
 * a sideways cap under run speed (`maxSideSpeed`). Takes effect in the next step's controller.
 */
function sprayRecoil(step: Omit<SprayStep, "reach">): void {
  const { ctx, attacker: shooter, fighter } = step;
  const limits = ctx.tunables.combat.sprayRecoil;
  const thrust = weaponTunables(ctx.tunables, step.itemId).recoil;
  const aim = weaponAim(shooter);
  const aimLength = Math.hypot(aim.x, aim.y);
  const kick = Math.min(thrust * step.dt, fighter.sprayRecoilLeft);
  if (aimLength === 0 || kick <= 0) return;
  const dx = pushUpTo(shooter.vx, (-aim.x / aimLength) * kick, limits.maxSideSpeed);
  const dy = (-aim.y / aimLength) * kick;
  shooter.vx += dx;
  shooter.vy += dy;
  fighter.sprayRecoilLeft -= Math.hypot(dx, dy);
}

/** A held spray weapon: spray this step and drain its fuel; emit the start cue on the first step. */
function spray(
  step: Omit<SprayStep, "itemId" | "reach"> & { reach: number | undefined },
  options: StepAttacksOptions
): void {
  const { ctx, attacker, fighter } = step;
  const weapon = fighter.weapon;
  if (!weapon || isProjectileWeapon(weapon.itemId)) return;
  const itemId = weapon.itemId;
  const reach = step.reach ?? sprayBeamOf(ctx.tunables, itemId).shape.length;
  if (!fighter.spraying) {
    const at = helmetPoint(attacker);
    const cue = { type: "sprayStarted" as const, itemId, slot: attacker.slot, x: at.x, y: at.y };
    emitCombatEvent(ctx.combat, cue, ctx.timeSeconds);
  }
  fighter.spraying = true;
  options.sprayAttack?.({ ...step, itemId, reach });
  if (!options.steadyShooter?.(attacker)) sprayRecoil({ ...step, itemId });
  weapon.ammo -= step.dt;
  if (weapon.ammo <= EMPTY_FUEL) fighter.weapon = null;
}

const holdsSprayWeapon = (fighter: FighterState): boolean =>
  fighter.weapon !== null && !isProjectileWeapon(fighter.weapon.itemId);

/** Whether this fighter sprays this step: fire held with a spray weapon, and still in play. */
const spraysNow = (fighter: FighterState, pressed: boolean): boolean =>
  pressed && !fighter.eliminated && holdsSprayWeapon(fighter);

interface AttackTurn extends UnarmedFirePress {
  pressed: boolean;
}

/**
 * Where this step's held beams end each other (beam-clash D1, `shared/utils/beamClash`): worked
 * out for all sprayers before any of them sprays, so who comes first in the player list does not
 * matter. Returns each sprayer's reach by slot and records the clashes on the combat state.
 */
function clashBeams(ctx: CombatContext, turns: readonly AttackTurn[]): Map<number, number> {
  const sprayers = turns.flatMap(({ attacker, fighter, pressed }) => {
    const itemId = fighter.weapon?.itemId;
    if (!itemId || isProjectileWeapon(itemId) || !spraysNow(fighter, pressed)) return [];
    const beam = sprayBeamOf(ctx.tunables, itemId);
    const aim = weaponAim(attacker);
    return [{ slot: attacker.slot, beam: { ...beam, origin: helmetPoint(attacker), aim } }];
  });
  const { reach, clashes } = resolveBeamClashes(
    terrainBodies(ctx.terrain),
    sprayers.map((sprayer) => sprayer.beam),
    ctx.tunables.combat.beamClash
  );
  ctx.combat.beamClashes = clashes;
  return new Map(sprayers.map((sprayer, i) => [sprayer.slot, reach[i] ?? 0]));
}

interface AttackFrame {
  pressed: boolean;
  options: StepAttacksOptions;
  /** This attacker's beam reach this step, when it sprays. */
  reach: number | undefined;
}

/** One attacker's fire button this step: a held spray weapon sprays, else a new press fires. */
function attack(press: UnarmedFirePress, frame: AttackFrame): void {
  const { fighter } = press;
  const { pressed, options } = frame;
  const isNewPress = pressed && !fighter.prevFire;
  fighter.prevFire = pressed;
  fighter.attackCooldown = Math.max(0, fighter.attackCooldown - options.dt);
  // The spray recoil's air budget refills on the ground, sprayed or not (spray-recoil D2).
  if (press.attacker.grounded) {
    fighter.sprayRecoilLeft = press.ctx.tunables.combat.sprayRecoil.airBudget;
  }
  const sprays = spraysNow(fighter, pressed);
  if (sprays) spray({ ...press, dt: options.dt, reach: frame.reach }, options);
  fighter.spraying = sprays && fighter.weapon !== null;
  // The weapon's fire cooldown only holds its own next shot: once the last rocket is gone an
  // unarmed press dives at once (dash-feel lap; it was dropped for up to 0.7 s).
  const reloading = fighter.weapon !== null && fighter.attackCooldown > 0;
  if (sprays || !isNewPress || fighter.eliminated || reloading) return;
  firePress(press, options.unarmedAttack);
}

export function stepAttacks(
  ctx: CombatContext,
  inputs: PlayerInputs,
  options: StepAttacksOptions
): void {
  const turns = ctx.players.map((attacker) => ({
    ctx,
    attacker,
    fighter: fighterFor(ctx.combat, attacker, ctx.tunables),
    pressed: inputs[attacker.slot]?.fire === true,
  }));
  const reach = clashBeams(ctx, turns);
  for (const { pressed, ...press } of turns) {
    attack(press, { pressed, options, reach: reach.get(press.attacker.slot) });
  }
}
