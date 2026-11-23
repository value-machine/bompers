/** Public seam of the combat feature: combat slice, sim step 3, elimination / respawn hooks, render layer. */
export type {
  CombatEvent,
  CombatEventBody,
  CombatState,
  CrushSqueeze,
  EliminationCause,
  FighterState,
  HeldWeapon,
  Hit,
  HitKind,
  HitSource,
  HitZone,
  RocketKind,
  RocketState,
} from "@/features/combat/types/combat.types";
export type {
  SprayAttackHook,
  SprayStep,
  UnarmedAttackHook,
  UnarmedFirePress,
} from "@/features/combat/services/attacks";
export { stepCombat, type StepCombatArgs } from "@/features/combat/services/combatSim";
export { helmetPoint } from "@/features/combat/services/combatGeometry";
export { reportTerrainDestroyed } from "@/features/combat/services/explosions";
export {
  maxWeaponRecoil,
  takeWeaponPickups,
  weaponTunables,
  type WeaponPickups,
} from "@/features/combat/services/weapons";
export {
  applyHit,
  classifyHitZone,
  createCombatState,
  hitDamageFor,
  type HitResult,
  type HitWorld,
  eliminateFighter,
  healFighter,
  reportPartSound,
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
