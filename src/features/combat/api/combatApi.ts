/** Public seam of the combat feature: combat slice, sim step 3, elimination / respawn hooks, render layer. */
export type {
  CombatEvent,
  CombatEventBody,
  CombatState,
  DamageCause,
  EliminationCause,
  FighterState,
  HeldWeapon,
  PickupState,
  RocketState,
} from "@/features/combat/types/combat.types";
export { stepCombat, type StepCombatArgs } from "@/features/combat/services/combatSim";
export {
  createCombatState,
  eliminateFighter,
  isFighterEliminated,
  respawnFighter,
  type EliminateArgs,
} from "@/features/combat/services/combatState";
export {
  createCombatView,
  syncCombatView,
  type CombatFrame,
  type CombatView,
} from "@/features/combat/services/combatRenderer";
