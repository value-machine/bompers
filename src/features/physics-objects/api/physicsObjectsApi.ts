/** Public seam of the physics-objects feature: moving bodies a level places (a ball). */
export type {
  ObjectBlobContact,
  ObjectMoment,
  PhysicsObject,
  PhysicsObjectsState,
  WholeObjectState,
} from "@/features/physics-objects/types/physicsObject.types";
export {
  createPhysicsObjectsState,
  objectsInPlay,
  popObject,
  stepPhysicsObjects,
  type StepPhysicsObjectsArgs,
} from "@/features/physics-objects/services/physicsObjects";
export type { ObjectBlast } from "@/features/physics-objects/services/objectContacts";
export {
  createPhysicsObjectsView,
  syncPhysicsObjectsView,
  type PhysicsObjectsFrame,
  type PhysicsObjectsView,
} from "@/features/physics-objects/services/physicsObjectRenderer";
