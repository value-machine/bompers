/** Public seam of the karts feature: drivable go-karts on physics-objects wheels (kart lap). */
export type { ChassisShape, Kart, KartsState } from "@/features/karts/services/kartModel";
export {
  createKartsState,
  driveKarts,
  kartEngines,
  kartRoundBodies,
  kartsInPlay,
  seatedInputs,
  stepKarts,
  type DriveStep,
  type StepKartsArgs,
} from "@/features/karts/services/karts";
export { driverIds, seatDrivers, stepSeats } from "@/features/karts/services/kartSeats";
export type { KartHit } from "@/features/karts/services/kartContacts";
export {
  createKartsView,
  syncKartsView,
  type KartsFrame,
  type KartsView,
} from "@/features/karts/services/kartRenderer";
