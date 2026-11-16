/** Public seam of the collectibles feature: sky drops (point orbs, weapon crates), sim steps, render layers. */
export type {
  CollectiblesState,
  CrateStepResult,
  DiveRefillCollected,
  DiveRefillPickup,
  OrbCollected,
  PointOrb,
  WeaponCrate,
  WeaponCratesState,
} from "@/features/collectibles/types/collectibles.types";
export {
  POINT_ORB_ITEM,
  createCollectiblesState,
  stepCollectibles,
  type StepCollectiblesArgs,
} from "@/features/collectibles/services/collectiblesSim";
export {
  DIVE_REFILL_ITEM,
  stepDiveRefills,
  type StepDiveRefillsArgs,
} from "@/features/collectibles/services/diveRefills";
export {
  stepWeaponCrates,
  type StepWeaponCratesArgs,
} from "@/features/collectibles/services/weaponCrates";
export {
  createCollectiblesView,
  syncCollectiblesView,
  type CollectiblesFrame,
  type CollectiblesView,
} from "@/features/collectibles/services/collectiblesRenderer";
