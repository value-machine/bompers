import type { PlayerInputs } from "@/shared/types/gameInput.types";
import type { PlayerState } from "@/features/player/api/playerApi";
import { bodyCenter, unitBetween } from "@/features/combat/services/combatGeometry";
import {
  damageFighter,
  emitCombatEvent,
  fighterFor,
  type CombatContext,
} from "@/features/combat/services/combatState";
import { fireRocket } from "@/features/combat/services/rockets";
import type { FighterState } from "@/features/combat/types/combat.types";

/**
 * The fire button (GDD § 3): armed players shoot a rocket, unarmed players bash. One action
 * per press, then a cooldown. Bash: the nearest other player within `bash.range` inside the
 * aim cone loses one chunk and is knocked away along the hit direction.
 */
function bashTarget(ctx: CombatContext, attacker: PlayerState): PlayerState | null {
  const { range, coneCos } = ctx.tunables.combat.bash;
  const from = bodyCenter(attacker);
  let best: PlayerState | null = null;
  let bestDistance = Infinity;
  for (const other of ctx.players) {
    if (other.id === attacker.id || ctx.combat.fighters.get(other.id)?.eliminated) continue;
    const to = bodyCenter(other);
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    if (distance > range || distance >= bestDistance) continue;
    const dir = unitBetween(from, to, { x: attacker.aimX, y: attacker.aimY });
    if (dir.x * attacker.aimX + dir.y * attacker.aimY < coneCos) continue;
    best = other;
    bestDistance = distance;
  }
  return best;
}

function knockBack(ctx: CombatContext, attacker: PlayerState, target: PlayerState): void {
  const { knockbackSpeed, knockbackLift } = ctx.tunables.combat.bash;
  const dir = unitBetween(bodyCenter(attacker), bodyCenter(target), {
    x: attacker.aimX,
    y: attacker.aimY,
  });
  target.vx = dir.x * knockbackSpeed;
  target.vy = Math.min(target.vy, dir.y * knockbackSpeed - knockbackLift);
  target.grounded = false;
}

function bash(ctx: CombatContext, attacker: PlayerState): void {
  const target = bashTarget(ctx, attacker);
  const center = bodyCenter(attacker);
  emitCombatEvent(
    ctx.combat,
    { type: "bash", slot: attacker.slot, x: center.x, y: center.y, hit: target !== null },
    ctx.timeSeconds
  );
  if (!target) return;
  knockBack(ctx, attacker, target);
  damageFighter({
    combat: ctx.combat,
    victim: fighterFor(ctx.combat, target, ctx.tunables),
    byPlayerSlot: attacker.slot,
    cause: "bash",
    timeSeconds: ctx.timeSeconds,
  });
}

function attack(ctx: CombatContext, player: PlayerState, fighter: FighterState): void {
  const { combat: tunables } = ctx.tunables;
  if (fighter.weapon) {
    fireRocket(ctx, player);
    fighter.weapon.ammo -= 1;
    if (fighter.weapon.ammo <= 0) fighter.weapon = null;
    fighter.attackCooldown = tunables.rocket.fireCooldown;
    return;
  }
  bash(ctx, player);
  fighter.attackCooldown = tunables.bash.cooldown;
}

export function stepAttacks(ctx: CombatContext, inputs: PlayerInputs, dt: number): void {
  for (const player of ctx.players) {
    const fighter = fighterFor(ctx.combat, player, ctx.tunables);
    const fire = inputs[player.slot]?.fire === true;
    const pressed = fire && !fighter.prevFire;
    fighter.prevFire = fire;
    fighter.attackCooldown = Math.max(0, fighter.attackCooldown - dt);
    if (!pressed || fighter.eliminated || fighter.attackCooldown > 0) continue;
    attack(ctx, player, fighter);
  }
}
