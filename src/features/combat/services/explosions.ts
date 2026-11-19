import type { Vec2 } from "@/shared/types/gameGeometry.types";
import type { CraterShape } from "@/shared/types/craterShape.types";
import { clearCraterOnBodies, type ClearedBodies } from "@/features/arena/api/arenaApi";
import { resolveCatalogEntry } from "@/features/content-catalog/api/contentCatalogApi";
import { hurtBox, hurtCenter, reactToHit, type PlayerState } from "@/features/player/api/playerApi";
import { distanceToRect, unitBetween } from "@/features/combat/services/combatGeometry";
import { blastHitPushAt, blastPushAt, blastReach, craterReach } from "@/shared/utils/blastPower";
import {
  applyHit,
  emitCombatEvent,
  fighterFor,
  type CombatContext,
} from "@/features/combat/services/combatState";
import type { CombatState } from "@/features/combat/types/combat.types";

/**
 * Explosions (GDD § 2 Rocket Jumping, § 3): a `blast` hit (1 chunk by default, from any side)
 * on every OTHER player in range,
 * a radial impulse on everyone in range (the shooter too — damage-free rocket jumps), the
 * roll on every other player as hard as the blast pushed it (`reactToHit`), and a
 * crater in breakable terrain with the material's destroy effect / sound as events. The blast's
 * power sets its reach, push and crater (`@/shared/utils/blastPower`, blast-power D1, D3).
 */
export interface Blast {
  at: Vec2;
  ownerSlot: number;
  ownerId: string;
  /** Blast power, 0–100 (the weapon's `power`; the rocket is 50). */
  power: number;
  /** The weapon's crater shape (terrain-field D5). */
  craterShape: CraterShape;
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
  const distance = distanceToRect(blast.at, hurtBox(player));
  // Everyone but the shooter takes the hit push; the shooter keeps the full push, so rocket jumps
  // stay as tuned (jumps-and-recoil D1).
  const strength =
    player.id === blast.ownerId
      ? blastPushAt(ctx.tunables, blast.power, distance)
      : blastHitPushAt(ctx.tunables, blast.power, distance);
  if (strength <= 0) return null;
  const direction = unitBetween(blast.at, hurtCenter(player), UP);
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
    // The shooter is only pushed: no damage and no roll, so rocket jumps stay in control.
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

/**
 * Logs terrain that went away (a crater, a fire burn-out) as one `terrainDestroyed` event per
 * material + colour at `at`, with the material's catalog effect and sound. `soundId` replaces the
 * material's sound when what destroyed it has its own (a fire burn-out; `"none"` = silent).
 */
export function reportTerrainDestroyed(
  combat: CombatState,
  report: {
    cleared: Pick<ClearedBodies, "byLook">;
    at: Vec2;
    timeSeconds: number;
    soundId?: string;
  }
): void {
  const { at } = report;
  for (const { materialId, colorId, cells } of report.cleared.byLook) {
    const material = resolveCatalogEntry("material", materialId).entry;
    emitCombatEvent(
      combat,
      {
        type: "terrainDestroyed",
        x: at.x,
        y: at.y,
        materialId,
        colorId,
        cells,
        effectId: material?.effect ?? "none",
        soundId: report.soundId ?? material?.sound ?? "none",
      },
      report.timeSeconds
    );
  }
}

function blastTerrain(ctx: CombatContext, blast: Blast): void {
  const { at } = blast;
  const reach = craterReach(ctx.tunables, blast.power);
  const cleared = clearCraterOnBodies(ctx.terrain, {
    x: at.x,
    y: at.y,
    reach,
    shape: blast.craterShape,
  });
  reportTerrainDestroyed(ctx.combat, { cleared, at, timeSeconds: ctx.timeSeconds });
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
