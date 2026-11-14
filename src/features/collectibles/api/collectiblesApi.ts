/** Public seam of the collectibles feature: point-orb state, sim step, render layer. */
export type {
  CollectiblesState,
  OrbCollected,
  PointOrb,
} from "@/features/collectibles/types/collectibles.types";
export {
  POINT_ORB_ITEM,
  createCollectiblesState,
  stepCollectibles,
  type StepCollectiblesArgs,
} from "@/features/collectibles/services/collectiblesSim";
export {
  createCollectiblesView,
  syncCollectiblesView,
  type CollectiblesFrame,
  type CollectiblesView,
} from "@/features/collectibles/services/collectiblesRenderer";
