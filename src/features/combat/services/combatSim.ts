import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { PlayerInputs } from "@/shared/types/gameInput.types";
import type { Rect, Vec2 } from "@/shared/types/gameGeometry.types";
import type { TerrainGrid } from "@/features/arena/api/arenaApi";
import type { PlayerState } from "@/features/player/api/playerApi";
import {
  stepAttacks,
  type SprayAttackHook,
  type UnarmedAttackHook,
} from "@/features/combat/services/attacks";
import {
  fighterFor,
  pruneCombatEvents,
  type CombatContext,
} from "@/features/combat/services/combatState";
import { stepRockets } from "@/features/combat/services/rockets";
import type { CombatState } from "@/features/combat/types/combat.types";

/**
 * Combat system (sim step 3, after players moved): fire button → rocket (or the unarmed hook), rockets fly
 * and explode. Weapon crates live in the collectibles feature; `takeWeaponPickups` arms whoever took
 * one. Velocity changes (knockback, blast impulse)
 * take effect in the next step's player controller. Eliminated fighters wait for match step 4.
 */
export interface StepCombatArgs {
  combat: CombatState;
  players: PlayerState[];
  inputs: PlayerInputs;
  terrain: TerrainGrid;
  /** The level's in-bounds area. */
  bounds: Rect;
  tunables: GameTunables;
  /** Sim time at the start of this step, seconds. */
  timeSeconds: number;
  dt: number;
  /** The unarmed attack on the fire button (dive lap). Omitted: unarmed fire does nothing. */
  unarmedAttack?: UnarmedAttackHook;
  /** Held spray weapons (the fire feature's torch). Omitted: spraying only drains fuel. */
  sprayAttack?: SprayAttackHook;
  /** Sprayers the spray recoil does not move (a seated driver, a diver). Omitted: none. */
  steadyShooter?: (shooter: PlayerState) => boolean;
  /** Round bodies rockets explode on (physics objects). Omitted: none. */
  roundBodies?: readonly { center: Vec2; radius: number }[];
}

export function stepCombat(args: StepCombatArgs): void {
  const { combat, players, inputs, terrain, bounds, tunables, timeSeconds, dt } = args;
  const ctx: CombatContext = {
    combat,
    players,
    terrain,
    bounds,
    tunables,
    timeSeconds,
    roundBodies: args.roundBodies ?? [],
  };
  pruneCombatEvents(combat, timeSeconds - tunables.combat.eventRetentionSeconds);
  for (const player of players) fighterFor(combat, player, tunables);
  stepAttacks(ctx, inputs, {
    dt,
    unarmedAttack: args.unarmedAttack,
    sprayAttack: args.sprayAttack,
    steadyShooter: args.steadyShooter,
  });
  stepRockets(ctx, dt);
}
