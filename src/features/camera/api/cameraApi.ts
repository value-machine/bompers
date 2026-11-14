/** Public seam of the camera feature: pure framing math and applying it to the world layer. */
export type {
  CameraFrameArgs,
  CameraSettings,
  CameraView,
  Viewport,
} from "@/features/camera/types/camera.types";
export { applyCameraView, computeCameraView } from "@/features/camera/services/cameraView";
