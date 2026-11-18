import type { PlayerInputs } from "@/shared/types/gameInput.types";
import type { SprayWeaponItemId } from "@/shared/types/weaponItems.types";
import type { PlayerState } from "@/features/player/api/playerApi";
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

/** A held spray weapon: spray this step and drain its fuel; emit the start cue on the first step. */
function spray(step: Omit<SprayStep, "itemId">, sprayAttack: SprayAttackHook | undefined): void {
  const { ctx, attacker, fighter } = step;
  const weapon = fighter.weapon;
  if (!weapon || isProjectileWeapon(weapon.itemId)) return;
  const itemId = weapon.itemId;
  if (!fighter.spraying) {
    const at = helmetPoint(attacker);
    const cue = { type: "sprayStarted" as const, itemId, slot: attacker.slot, x: at.x, y: at.y };
    emitCombatEvent(ctx.combat, cue, ctx.timeSeconds);
  }
  fighter.spraying = true;
  sprayAttack?.({ ...step, itemId });
  weapon.ammo -= step.dt;
  if (weapon.ammo <= EMPTY_FUEL) fighter.weapon = null;
}

const holdsSprayWeapon = (fighter: FighterState): boolean =>
  fighter.weapon !== null && !isProjectileWeapon(fighter.weapon.itemId);

/** One attacker's fire button this step: a held spray weapon sprays, else a new press fires. */
function attack(press: UnarmedFirePress, frame: { pressed: boolean; options: StepAttacksOptions }) {
  const { fighter } = press;
  const { pressed, options } = frame;
  const isNewPress = pressed && !fighter.prevFire;
  fighter.prevFire = pressed;
  fighter.attackCooldown = Math.max(0, fighter.attackCooldown - options.dt);
  const sprays = pressed && !fighter.eliminated && holdsSprayWeapon(fighter);
  if (sprays) spray({ ...press, dt: options.dt }, options.sprayAttack);
  fighter.spraying = sprays && fighter.weapon !== null;
  if (sprays || !isNewPress || fighter.eliminated || fighter.attackCooldown > 0) return;
  firePress(press, options.unarmedAttack);
}

export function stepAttacks(
  ctx: CombatContext,
  inputs: PlayerInputs,
  options: StepAttacksOptions
): void {
  for (const attacker of ctx.players) {
    const fighter = fighterFor(ctx.combat, attacker, ctx.tunables);
    const pressed = inputs[attacker.slot]?.fire === true;
    attack({ ctx, attacker, fighter }, { pressed, options });
  }
}
