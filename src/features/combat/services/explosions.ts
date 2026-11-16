import type { Vec2 } from "@/shared/types/gameGeometry.types";
import { clearCrater } from "@/features/arena/api/arenaApi";
import { resolveCatalogEntry } from "@/features/content-catalog/api/contentCatalogApi";
import { playerBody, reactToHit, type PlayerState } from "@/features/player/api/playerApi";
import { bodyCenter, distanceToRect, unitBetween } from "@/features/combat/services/combatGeometry";
import { blastPushAt, blastReach, craterReach } from "@/shared/utils/blastPower";
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
 * crater in breakable terrain with the material's destroy effect / sound as events. The blast's
 * power sets its reach, push and crater (`@/shared/utils/blastPower`, blast-power D1, D3).
 */
export interface Blast {
  at: Vec2;
  ownerSlot: number;
  ownerId: string;
  /** Blast power, 0–100 (the weapon's `power`; the rocket is 50). */
  power: number;
}

const UP: Vec2 = { x: 0, y: -1 };

interface BlastPush {
  /** Unit direction away from the blast. */
  direction: Vec2;
  /** Velocity change the blast gave the player, units / s. */
  impulse: Vec2;
}

/**
 * Pushes one player away from the blast; returns the push, or null when out of range. The push
 * is the seam the hurt reaction reads (`reactToHit`): one direction + impulse per player.
 */
function pushPlayer(ctx: CombatContext, player: PlayerState, blast: Blast): BlastPush | null {
  const distance = distanceToRect(blast.at, playerBody(player));
  const strength = blastPushAt(ctx.tunables, blast.power, distance);
  if (strength <= 0) return null;
  const direction = unitBetween(blast.at, bodyCenter(player), UP);
  const push = { x: direction.x * strength, y: direction.y * strength };
  player.vx += push.x;
  player.vy += push.y;
  player.grounded = false;
  return { direction, impulse: push };
}

function hitPlayers(ctx: CombatContext, blast: Blast): void {
  for (const player of ctx.players) {
    const fighter = fighterFor(ctx.combat, player, ctx.tunables);
    if (fighter.eliminated) continue;
    const push = pushPlayer(ctx, player, blast);
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

function blastTerrain(ctx: CombatContext, blast: Blast): void {
  const { at } = blast;
  const reach = craterReach(ctx.tunables, blast.power);
  const cleared = clearCrater(ctx.terrain, { x: at.x, y: at.y, reach });
  for (const { materialId, colorId, cells } of cleared.byLook) {
    const material = resolveCatalogEntry("material", materialId).entry;
    emitCombatEvent(
      ctx.combat,
      {
        type: "terrainDestroyed",
        x: at.x,
        y: at.y,
        materialId,
        colorId,
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
      radius: blastReach(ctx.tunables, blast.power),
    },
    ctx.timeSeconds
  );
  hitPlayers(ctx, blast);
  blastTerrain(ctx, blast);
}
