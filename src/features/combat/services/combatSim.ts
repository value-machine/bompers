import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { PlayerInputs } from "@/shared/types/gameInput.types";
import type { Rect } from "@/shared/types/gameGeometry.types";
import type { TerrainGrid } from "@/features/arena/api/arenaApi";
import type { PlayerState } from "@/features/player/api/playerApi";
import { stepAttacks, type UnarmedAttackHook } from "@/features/combat/services/attacks";
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
}

export function stepCombat(args: StepCombatArgs): void {
  const { combat, players, inputs, terrain, bounds, tunables, timeSeconds, dt } = args;
  const ctx: CombatContext = { combat, players, terrain, bounds, tunables, timeSeconds };
  pruneCombatEvents(combat, timeSeconds - tunables.combat.eventRetentionSeconds);
  for (const player of players) fighterFor(combat, player, tunables);
  stepAttacks(ctx, inputs, { dt, unarmedAttack: args.unarmedAttack });
  stepRockets(ctx, dt);
}
