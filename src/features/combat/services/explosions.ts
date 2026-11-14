import type { Vec2 } from "@/shared/types/gameGeometry.types";
import { clearCircle } from "@/features/arena/api/arenaApi";
import { resolveCatalogEntry } from "@/features/content-catalog/api/contentCatalogApi";
import { playerBody, type PlayerState } from "@/features/player/api/playerApi";
import { bodyCenter, distanceToRect, unitBetween } from "@/features/combat/services/combatGeometry";
import {
  damageFighter,
  emitCombatEvent,
  fighterFor,
  type CombatContext,
} from "@/features/combat/services/combatState";

/**
 * Explosions (GDD § 2 Rocket Jumping, § 3): exactly one chunk off every OTHER player in range,
 * a radial impulse on everyone in range (the shooter too — damage-free rocket jumps), and a
 * crater in destructible terrain with the material's destroy effect / sound as events.
 */
export interface Blast {
  at: Vec2;
  ownerSlot: number;
  ownerId: string;
}

const UP: Vec2 = { x: 0, y: -1 };

/** Pushes one player away from the blast; returns false when out of range. */
function pushPlayer(ctx: CombatContext, player: PlayerState, at: Vec2): boolean {
  const { radius, impulse, minFalloff } = ctx.tunables.combat.explosion;
  const distance = distanceToRect(at, playerBody(player));
  if (distance > radius) return false;
  const falloff = Math.max(minFalloff, 1 - distance / radius);
  const direction = unitBetween(at, bodyCenter(player), UP);
  player.vx += direction.x * impulse * falloff;
  player.vy += direction.y * impulse * falloff;
  player.grounded = false;
  return true;
}

function hitPlayers(ctx: CombatContext, blast: Blast): void {
  for (const player of ctx.players) {
    const fighter = fighterFor(ctx.combat, player, ctx.tunables);
    if (fighter.eliminated) continue;
    if (!pushPlayer(ctx, player, blast.at)) continue;
    if (player.id === blast.ownerId) continue;
    damageFighter({
      combat: ctx.combat,
      victim: fighter,
      byPlayerSlot: blast.ownerSlot,
      cause: "rocket",
      timeSeconds: ctx.timeSeconds,
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
