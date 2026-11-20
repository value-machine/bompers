/** Public seam of the level-objects feature: the object registry and placing an object. */
export type {
  ExportedObjectRecipe,
  ObjectPart,
  ObjectPlacement,
  ObjectPlacementRequest,
  ObjectRecipe,
  ObjectRotation,
} from "@/features/level-objects/types/levelObject.types";
export {
  OBJECT_RECIPES,
  exportObjectCatalog,
  findObjectRecipe,
} from "@/features/level-objects/services/objectRegistry";
export { placeObject } from "@/features/level-objects/services/objectPlacement";
