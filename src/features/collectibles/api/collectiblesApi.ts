/** Public seam of the collectibles feature: sky drops (point orbs, weapon crates), sim steps, render layers. */
export type {
  CollectiblesState,
  CrateStepResult,
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
/** The touch test every pickup shares (sky drops here, fixed pickups in `fixed-pickups`). */
export { firstToucher } from "@/features/collectibles/services/skyDrops";
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
