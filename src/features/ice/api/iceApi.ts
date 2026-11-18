/** Public seam of the ice feature: frozen ground on the terrain field, the freeze ray, the ice layers. */
export type { FreezeRayBeam, IceState } from "@/features/ice/types/ice.types";
export { canFreeze, createIceState, feedCold, stepIce } from "@/features/ice/services/iceSim";
export { sprayFreezeRay, type FreezeRayArgs } from "@/features/ice/services/freezeRay";
export {
  createIceView,
  syncIceView,
  type IceFrame,
  type IceView,
} from "@/features/ice/services/iceRenderer";
