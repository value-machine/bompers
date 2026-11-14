import type { Rect } from "@/shared/types/gameGeometry.types";
import { rectHitsSolid } from "@/features/arena/api/arenaApi";
import type { LevelDrop } from "@/features/level/api/levelApi";
import { playerBody } from "@/features/player/api/playerApi";
import { rectsOverlap } from "@/features/combat/services/combatGeometry";
import { emitCombatEvent, type CombatContext } from "@/features/combat/services/combatState";
import type { PickupState } from "@/features/combat/types/combat.types";

/**
 * Weapon pickups (GDD § 3, § 4: weapons fall from the sky). Deterministic schedule: after
 * `firstDelaySeconds`, then every `intervalSeconds` while fewer than `maxActive` lie in the
 * arena, the next drop point (round-robin) releases a launcher. Pickups fall with the match
 * gravity, land on terrain (and fall again when the ground is blasted away), vanish out of
 * bounds, and are taken by the first player touching them (full ammo).
 */
const LAUNCHER = "rocket-launcher";

export const pickupBox = (pickup: PickupState, size: number): Rect => ({
  x: pickup.x - size / 2,
  y: pickup.y - size,
  w: size,
  h: size,
});

function spawnDrop(ctx: CombatContext, drops: readonly LevelDrop[]): void {
  const { combat } = ctx;
  const drop = drops[combat.nextDropIndex % drops.length];
  combat.nextDropIndex += 1;
  if (!drop?.itemIds.includes(LAUNCHER)) return;
  combat.pickups.push({
    id: combat.nextEntityId,
    itemId: LAUNCHER,
    x: drop.at.x,
    y: drop.at.y,
    vy: 0,
    grounded: false,
  });
  combat.nextEntityId += 1;
  emitCombatEvent(
    combat,
    { type: "pickupSpawned", itemId: LAUNCHER, x: drop.at.x, y: drop.at.y },
    ctx.timeSeconds
  );
}

function stepDropSchedule(ctx: CombatContext, drops: readonly LevelDrop[], dt: number): void {
  const { combat } = ctx;
  const schedule = ctx.tunables.combat.drops;
  combat.dropTimer -= dt;
  if (combat.dropTimer > 0) return;
  combat.dropTimer = schedule.intervalSeconds;
  if (drops.length > 0 && combat.pickups.length < schedule.maxActive) spawnDrop(ctx, drops);
}

/** Snaps the pickup onto the top of the cell row it entered. */
function land(pickup: PickupState, cell: number): void {
  pickup.y = Math.floor(pickup.y / cell) * cell;
  pickup.vy = 0;
  pickup.grounded = true;
}

/** Falls in half-cell sub-steps; on contact lands on the cell row it entered. */
function fall(ctx: CombatContext, pickup: PickupState, dt: number): void {
  const { gravity, maxFallSpeed } = ctx.tunables.world;
  const size = ctx.tunables.combat.drops.size;
  const cell = ctx.terrain.cellSize;
  const below = { ...pickupBox(pickup, size), y: pickup.y, h: 1 };
  if (pickup.grounded && rectHitsSolid(ctx.terrain, below)) return;
  pickup.grounded = false;
  pickup.vy = Math.min(maxFallSpeed, pickup.vy + gravity * dt);
  const distance = pickup.vy * dt;
  const steps = Math.max(1, Math.ceil(distance / (cell / 2)));
  for (let i = 0; i < steps; i += 1) {
    pickup.y += distance / steps;
    if (!rectHitsSolid(ctx.terrain, pickupBox(pickup, size))) continue;
    land(pickup, cell);
    return;
  }
}

/** The first non-eliminated player touching the pickup takes it. Returns true when taken. */
function collect(ctx: CombatContext, pickup: PickupState): boolean {
  const box = pickupBox(pickup, ctx.tunables.combat.drops.size);
  for (const player of ctx.players) {
    const fighter = ctx.combat.fighters.get(player.id);
    if (!fighter || fighter.eliminated || !rectsOverlap(box, playerBody(player))) continue;
    fighter.weapon = { itemId: pickup.itemId, ammo: ctx.tunables.combat.rocket.ammo };
    emitCombatEvent(
      ctx.combat,
      { type: "pickupCollected", itemId: pickup.itemId, slot: player.slot },
      ctx.timeSeconds
    );
    return true;
  }
  return false;
}

export function stepPickups(ctx: CombatContext, drops: readonly LevelDrop[], dt: number): void {
  stepDropSchedule(ctx, drops, dt);
  ctx.combat.pickups = ctx.combat.pickups.filter((pickup) => {
    fall(ctx, pickup, dt);
    // Drop points may sit above the bounds top; only the bottom and sides remove a pickup.
    const { x, w, y, h } = ctx.bounds;
    const outside = pickup.y > y + h || pickup.x < x || pickup.x > x + w;
    return !outside && !collect(ctx, pickup);
  });
}
