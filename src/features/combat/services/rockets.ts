import type { Vec2 } from "@/shared/types/gameGeometry.types";
import { isSolidAt } from "@/features/arena/api/arenaApi";
import { hurtBox, weaponAim, type PlayerState } from "@/features/player/api/playerApi";
import { bodyCenter, helmetPoint, rectContains } from "@/features/combat/services/combatGeometry";
import { emitCombatEvent, type CombatContext } from "@/features/combat/services/combatState";
import { explode } from "@/features/combat/services/explosions";
import { flightTunables } from "@/features/combat/services/weapons";
import type { RocketKind, RocketState } from "@/features/combat/types/combat.types";

/**
 * Rockets (every kind, homing-missiles D1): leave the helmet along the weapon aim (`weaponAim`) at their kind's
 * speed, fly straight (a homing missile first steers, § Homing guidance below), and explode on
 * the first contact with terrain, another player or the edge of `ctx.bounds` (the match's kill
 * zone, far outside the level bounds except at the bottom), or at their kind's lifetime. Motion
 * is swept in sub-steps of at most half a terrain cell, so no speed tunnels through a one-cell
 * wall or a player.
 */
export function fireRocket(ctx: CombatContext, shooter: PlayerState, kind: RocketKind): void {
  const helmet = helmetPoint(shooter);
  const aim = weaponAim(shooter);
  const offset = ctx.tunables.combat.rocket.muzzleOffset;
  const muzzle = { x: helmet.x + aim.x * offset, y: helmet.y + aim.y * offset };
  const rocket: RocketState = {
    id: ctx.combat.nextEntityId,
    kind,
    targetId: kind === "homing" ? pickHomingTarget(ctx, aim, { shooter, from: muzzle }) : null,
    ownerSlot: shooter.slot,
    ownerId: shooter.id,
    x: muzzle.x,
    y: muzzle.y,
    dirX: aim.x,
    dirY: aim.y,
    age: 0,
  };
  ctx.combat.nextEntityId += 1;
  ctx.combat.rockets.push(rocket);
  kickShooter(shooter, aim, flightTunables(ctx.tunables, kind).recoil);
  emitCombatEvent(
    ctx.combat,
    {
      type: "rocketFired",
      kind,
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
      isLive(ctx, player) &&
      rectContains(hurtBox(player), point, margin)
  );
}

/** Moves one rocket through this step; returns the contact point, or null if it flew freely. */
function sweepRocket(ctx: CombatContext, rocket: RocketState, dt: number): Vec2 | null {
  const distance = flightTunables(ctx.tunables, rocket.kind).speed * dt;
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
    steerHoming(ctx, rocket, dt);
    const contact = sweepRocket(ctx, rocket, dt);
    rocket.age += dt;
    const flight = flightTunables(ctx.tunables, rocket.kind);
    const expired = rocket.age >= flight.maxLifetime;
    if (contact || expired) {
      explode(ctx, {
        at: contact ?? { x: rocket.x, y: rocket.y },
        ownerSlot: rocket.ownerSlot,
        ownerId: rocket.ownerId,
        power: flight.power,
        craterShape: flight.craterShape,
      });
    } else {
      flying.push(rocket);
    }
  }
  ctx.combat.rockets = flying;
}

/** Recoil: pushes the shooter opposite the shot; an upward kick leaves the ground. */
function kickShooter(shooter: PlayerState, aim: Vec2, recoil: number): void {
  shooter.vx -= aim.x * recoil;
  shooter.vy -= aim.y * recoil;
  if (aim.y > 0) shooter.grounded = false;
}

/*
 * § Homing guidance (homing-missiles D2) — the dodge rule in one place; numbers in `combat.homing`:
 * - Target: locked once at launch — the nearest live opponent within `lockConeDegrees` of the
 *   aim; none → it flies straight like a slow rocket. It never re-targets.
 * - Lock-on delay: straight for `lockDelaySeconds`, so a point-blank shot cannot curl round.
 * - Turn rate: at most `turnRate` rad / s, so the turn radius is `speed / turnRate`; a target
 *   that sidesteps or jumps late makes it overshoot.
 * - Fuel: steering stops at `fuelSeconds`; it then flies straight until contact or lifetime.
 * - Target gone (eliminated or left the match): straight from then on.
 */
const isLive = (ctx: CombatContext, player: PlayerState): boolean =>
  ctx.combat.fighters.get(player.id)?.eliminated !== true;

/** The opponent a missile fired from `from` along the unit `aim` locks on, or null. */
function pickHomingTarget(
  ctx: CombatContext,
  aim: Vec2,
  { shooter, from }: { shooter: PlayerState; from: Vec2 }
): string | null {
  const coneCos = Math.cos((ctx.tunables.combat.homing.lockConeDegrees * Math.PI) / 180);
  let best: { id: string; distance: number } | null = null;
  for (const player of ctx.players) {
    if (player.id === shooter.id || !isLive(ctx, player)) continue;
    const centre = bodyCenter(player);
    const dx = centre.x - from.x;
    const dy = centre.y - from.y;
    const distance = Math.hypot(dx, dy);
    const inCone = distance === 0 || (dx * aim.x + dy * aim.y) / distance >= coneCos;
    if (inCone && (!best || distance < best.distance)) best = { id: player.id, distance };
  }
  return best?.id ?? null;
}

const wrapAngle = (angle: number): number => Math.atan2(Math.sin(angle), Math.cos(angle));

/** Turns a homing missile toward its target by at most `turnRate × dt`; others are untouched. */
function steerHoming(ctx: CombatContext, rocket: RocketState, dt: number): void {
  if (rocket.kind !== "homing" || rocket.targetId === null) return;
  const homing = ctx.tunables.combat.homing;
  if (rocket.age < homing.lockDelaySeconds || rocket.age >= homing.fuelSeconds) return;
  const target = ctx.players.find((player) => player.id === rocket.targetId);
  if (!target || !isLive(ctx, target)) {
    rocket.targetId = null;
    return;
  }
  const centre = bodyCenter(target);
  const heading = Math.atan2(rocket.dirY, rocket.dirX);
  const wanted = Math.atan2(centre.y - rocket.y, centre.x - rocket.x);
  const maxTurn = homing.turnRate * dt;
  const turn = Math.max(-maxTurn, Math.min(maxTurn, wrapAngle(wanted - heading)));
  rocket.dirX = Math.cos(heading + turn);
  rocket.dirY = Math.sin(heading + turn);
}
