/** Public seam of the fire feature: fire on the terrain field, the torch spray, the fire layers. */
export type { FireState, GroundFire, TorchSpray } from "@/features/fire/types/fire.types";
export {
  burningCount,
  burningSamples,
  canBurn,
  createFireState,
  ignite,
  stepFire,
} from "@/features/fire/services/fireSim";
export { sprayTorch, type TorchSprayArgs } from "@/features/fire/services/torch";
export {
  createFireView,
  syncFireView,
  type FireFrame,
  type FireView,
} from "@/features/fire/services/fireRenderer";
