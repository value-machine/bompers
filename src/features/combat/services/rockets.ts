import type { Vec2 } from "@/shared/types/gameGeometry.types";
import { isSolidAt } from "@/features/arena/api/arenaApi";
import { playerBody, type PlayerState } from "@/features/player/api/playerApi";
import { helmetPoint, rectContains } from "@/features/combat/services/combatGeometry";
import { emitCombatEvent, type CombatContext } from "@/features/combat/services/combatState";
import { explode } from "@/features/combat/services/explosions";
import type { RocketState } from "@/features/combat/types/combat.types";

/**
 * Rockets: leave the helmet along the unit aim, fly straight, and explode on the first contact
 * with terrain, another player or the edge of `ctx.bounds` (the match's kill zone, far outside
 * the level bounds except at the bottom). Motion is swept in sub-steps of at most
 * half a terrain cell, so no speed tunnels through a one-cell wall or a player.
 */
export function fireRocket(ctx: CombatContext, shooter: PlayerState): void {
  const helmet = helmetPoint(shooter);
  const offset = ctx.tunables.combat.rocket.muzzleOffset;
  const rocket: RocketState = {
    id: ctx.combat.nextEntityId,
    ownerSlot: shooter.slot,
    ownerId: shooter.id,
    x: helmet.x + shooter.aimX * offset,
    y: helmet.y + shooter.aimY * offset,
    dirX: shooter.aimX,
    dirY: shooter.aimY,
    age: 0,
  };
  ctx.combat.nextEntityId += 1;
  ctx.combat.rockets.push(rocket);
  emitCombatEvent(
    ctx.combat,
    {
      type: "rocketFired",
      slot: shooter.slot,
      x: rocket.x,
      y: rocket.y,
      dirX: rocket.dirX,
      dirY: rocket.dirY,
    },
    ctx.timeSeconds
  );
}

/** True when a rocket at `point` touches something it explodes on. */
function touchesSomething(ctx: CombatContext, rocket: RocketState, point: Vec2): boolean {
  if (!rectContains(ctx.bounds, point)) return true;
  if (isSolidAt(ctx.terrain, point.x, point.y)) return true;
  const margin = ctx.tunables.combat.rocket.radius;
  return ctx.players.some(
    (player) =>
      player.id !== rocket.ownerId &&
      ctx.combat.fighters.get(player.id)?.eliminated !== true &&
      rectContains(playerBody(player), point, margin)
  );
}

/** Moves one rocket through this step; returns the contact point, or null if it flew freely. */
function sweepRocket(ctx: CombatContext, rocket: RocketState, dt: number): Vec2 | null {
  const distance = ctx.tunables.combat.rocket.speed * dt;
  const maxSubstep = ctx.terrain.cellSize / 2;
  const steps = Math.max(1, Math.ceil(distance / maxSubstep));
  const stepLength = distance / steps;
  // Sample the spawn point too: a rocket fired into a wall at point blank explodes at once.
  if (rocket.age === 0 && touchesSomething(ctx, rocket, rocket))
    return { x: rocket.x, y: rocket.y };
  for (let i = 0; i < steps; i += 1) {
    rocket.x += rocket.dirX * stepLength;
    rocket.y += rocket.dirY * stepLength;
    if (touchesSomething(ctx, rocket, rocket)) return { x: rocket.x, y: rocket.y };
  }
  return null;
}

export function stepRockets(ctx: CombatContext, dt: number): void {
  const flying: RocketState[] = [];
  for (const rocket of ctx.combat.rockets) {
    const contact = sweepRocket(ctx, rocket, dt);
    rocket.age += dt;
    const expired = rocket.age >= ctx.tunables.combat.rocket.maxLifetime;
    if (contact || expired) {
      explode(ctx, {
        at: contact ?? { x: rocket.x, y: rocket.y },
        ownerSlot: rocket.ownerSlot,
        ownerId: rocket.ownerId,
      });
    } else {
      flying.push(rocket);
    }
  }
  ctx.combat.rockets = flying;
}
