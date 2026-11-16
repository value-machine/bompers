/** Public seam of the camera feature: pure framing math, screen shake, and applying both to the world layer. */
export type {
  CameraFrameArgs,
  CameraSettings,
  CameraView,
  Viewport,
} from "@/features/camera/types/camera.types";
export { applyCameraView, computeCameraView } from "@/features/camera/services/cameraView";
export {
  cameraShakeOffset,
  createCameraShake,
  kickCameraShake,
  type CameraShake,
} from "@/features/camera/services/cameraShake";
