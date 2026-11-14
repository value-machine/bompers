/** Public seam of the combat feature: combat slice, sim step 3, elimination / respawn hooks, render layer. */
export type {
  CombatEvent,
  CombatEventBody,
  CombatState,
  EliminationCause,
  FighterState,
  HeldWeapon,
  Hit,
  HitKind,
  HitSource,
  HitZone,
  RocketState,
} from "@/features/combat/types/combat.types";
export type { UnarmedAttackHook, UnarmedFirePress } from "@/features/combat/services/attacks";
export { stepCombat, type StepCombatArgs } from "@/features/combat/services/combatSim";
export { takeWeaponPickups, type WeaponPickups } from "@/features/combat/services/weaponPickups";
export {
  applyHit,
  classifyHitZone,
  createCombatState,
  hitDamageFor,
  type HitResult,
  type HitWorld,
  eliminateFighter,
  isFighterEliminated,
  respawnFighter,
  type CombatContext,
  type EliminateArgs,
} from "@/features/combat/services/combatState";
export {
  createCombatView,
  syncCombatView,
  type CombatFrame,
  type CombatView,
} from "@/features/combat/services/combatRenderer";
