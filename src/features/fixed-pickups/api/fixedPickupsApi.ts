/** Public seam of the fixed-pickups feature: pickups fixed on level points (headbutt reset, health). */
export type {
  FixedPickup,
  FixedPickupItem,
  FixedPickupTaken,
} from "@/features/fixed-pickups/types/fixedPickups.types";
export {
  DIVE_REFILL_ITEM,
  HEALTH_PICKUP_ITEM,
  createFixedPickups,
  fixedPickupRule,
  stepFixedPickups,
  type StepFixedPickupsArgs,
} from "@/features/fixed-pickups/services/fixedPickups";
export {
  createFixedPickupsView,
  syncFixedPickupsView,
  type FixedPickupsFrame,
  type FixedPickupsView,
} from "@/features/fixed-pickups/services/fixedPickupsRenderer";
