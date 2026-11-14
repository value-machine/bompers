import type { PlayerInputs } from "@/shared/types/gameInput.types";
import type { PlayerState } from "@/features/player/api/playerApi";
import { fighterFor, type CombatContext } from "@/features/combat/services/combatState";
import { fireRocket } from "@/features/combat/services/rockets";
import type { FighterState } from "@/features/combat/types/combat.types";

/**
 * The fire button (GDD § 3), one action per press: armed players shoot a rocket (then a
 * cooldown); unarmed players go to the `unarmedAttack` hook. Without a hook, unarmed fire
 * does nothing.
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

export interface StepAttacksOptions {
  dt: number;
  unarmedAttack?: UnarmedAttackHook;
}

function fire(press: UnarmedFirePress, unarmedAttack: UnarmedAttackHook | undefined): void {
  const { ctx, attacker, fighter } = press;
  if (!fighter.weapon) {
    unarmedAttack?.(press);
    return;
  }
  fireRocket(ctx, attacker);
  fighter.weapon.ammo -= 1;
  if (fighter.weapon.ammo <= 0) fighter.weapon = null;
  fighter.attackCooldown = ctx.tunables.combat.rocket.fireCooldown;
}

export function stepAttacks(
  ctx: CombatContext,
  inputs: PlayerInputs,
  { dt, unarmedAttack }: StepAttacksOptions
): void {
  for (const attacker of ctx.players) {
    const fighter = fighterFor(ctx.combat, attacker, ctx.tunables);
    const pressed = inputs[attacker.slot]?.fire === true;
    const isNewPress = pressed && !fighter.prevFire;
    fighter.prevFire = pressed;
    fighter.attackCooldown = Math.max(0, fighter.attackCooldown - dt);
    if (!isNewPress || fighter.eliminated || fighter.attackCooldown > 0) continue;
    fire({ ctx, attacker, fighter }, unarmedAttack);
  }
}
