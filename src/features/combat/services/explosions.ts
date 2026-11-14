import type { Vec2 } from "@/shared/types/gameGeometry.types";
import { clearCircle } from "@/features/arena/api/arenaApi";
import { resolveCatalogEntry } from "@/features/content-catalog/api/contentCatalogApi";
import { playerBody, reactToHit, type PlayerState } from "@/features/player/api/playerApi";
import { bodyCenter, distanceToRect, unitBetween } from "@/features/combat/services/combatGeometry";
import {
  applyHit,
  emitCombatEvent,
  fighterFor,
  type CombatContext,
} from "@/features/combat/services/combatState";

/**
 * Explosions (GDD § 2 Rocket Jumping, § 3): a `blast` hit (1 chunk by default, from any side)
 * on every OTHER player in range,
 * a radial impulse on everyone in range (the shooter too — damage-free rocket jumps), the
 * tumble hurt reaction on every other player the blast pushed hard (`reactToHit`), and a
 * crater in destructible terrain with the material's destroy effect / sound as events.
 */
export interface Blast {
  at: Vec2;
  ownerSlot: number;
  ownerId: string;
}

const UP: Vec2 = { x: 0, y: -1 };

interface BlastPush {
  /** Unit direction away from the blast. */
  direction: Vec2;
  /** Velocity change the blast gave the player, units / s. */
  impulse: Vec2;
}

/** Pushes one player away from the blast; returns the push, or null when out of range. */
function pushPlayer(ctx: CombatContext, player: PlayerState, at: Vec2): BlastPush | null {
  const { radius, impulse, minFalloff } = ctx.tunables.combat.explosion;
  const distance = distanceToRect(at, playerBody(player));
  if (distance > radius) return null;
  const falloff = Math.max(minFalloff, 1 - distance / radius);
  const direction = unitBetween(at, bodyCenter(player), UP);
  const push = { x: direction.x * impulse * falloff, y: direction.y * impulse * falloff };
  player.vx += push.x;
  player.vy += push.y;
  player.grounded = false;
  return { direction, impulse: push };
}

function hitPlayers(ctx: CombatContext, blast: Blast): void {
  for (const player of ctx.players) {
    const fighter = fighterFor(ctx.combat, player, ctx.tunables);
    if (fighter.eliminated) continue;
    const push = pushPlayer(ctx, player, blast.at);
    // The shooter is only pushed: no damage and no tumble, so rocket jumps stay in control.
    if (!push || player.id === blast.ownerId) continue;
    reactToHit(player, { impulse: push.impulse }, ctx.tunables);
    applyHit(ctx, {
      victimSlot: player.slot,
      attackerSlot: blast.ownerSlot,
      kind: "blast",
      source: "rocket",
      contactPoint: blast.at,
      direction: push.direction,
    });
  }
}

function blastTerrain(ctx: CombatContext, at: Vec2): void {
  const radius = ctx.tunables.combat.explosion.craterRadius;
  const cleared = clearCircle(ctx.terrain, { x: at.x, y: at.y, radius });
  for (const [materialId, cells] of Object.entries(cleared.byMaterial)) {
    const material = resolveCatalogEntry("material", materialId).entry;
    emitCombatEvent(
      ctx.combat,
      {
        type: "terrainDestroyed",
        x: at.x,
        y: at.y,
        materialId,
        cells,
        effectId: material?.effect ?? "none",
        soundId: material?.sound ?? "none",
      },
      ctx.timeSeconds
    );
  }
}

export function explode(ctx: CombatContext, blast: Blast): void {
  emitCombatEvent(
    ctx.combat,
    {
      type: "explosion",
      byPlayerSlot: blast.ownerSlot,
      x: blast.at.x,
      y: blast.at.y,
      radius: ctx.tunables.combat.explosion.radius,
    },
    ctx.timeSeconds
  );
  hitPlayers(ctx, blast);
  blastTerrain(ctx, blast.at);
}
