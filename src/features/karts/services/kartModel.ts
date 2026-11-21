import type { Vec2 } from "@/shared/types/gameGeometry.types";
import type { KartBodySpec } from "@/shared/types/physicsBody.types";
import type {
  PhysicsObject,
  WholeObjectState,
} from "@/features/physics-objects/api/physicsObjectsApi";

/**
 * One kart a level placed (kart lap K2): two wheels that are physics-objects round bodies (they
 * move, bump, ride parts, burn, freeze and pop there) and a chassis held above the line between
 * them on a spring. The chassis is a lag of the spring, not a body of its own against terrain.
 */
export interface Kart {
  /** Stable for the match: `kart-<ordinal>` in level order. */
  id: string;
  variant: string;
  body: KartBodySpec;
  /** Placed box size: length and overall height. */
  length: number;
  height: number;
  /** Rear-left and front-right wheel at rest (index 0 is the left one when placed). */
  wheels: readonly [PhysicsObject, PhysicsObject];
  /** Chassis offset from its rest place on the axle line, and its speed (the spring's state). */
  spring: Vec2;
  springVelocity: Vec2;
  /** The axle middle's speed last step (the chassis lags behind its changes). */
  axleVelocity: Vec2;
  /** Way the kart drove last: -1 left, 1 right (the seat sits toward the back). */
  facing: -1 | 1;
  /** Player id in the seat, or null. */
  driverId: string | null;
  /** The whole kart's fire / frost as its wheels last agreed (kart: whole-object state). */
  state: WholeObjectState;
  /** Axle middle speed at the start of this step (hits read it before bumps take speed off). */
  stepStartVelocity: Vec2;
}

/** The kart's chassis this step, in world space: a capsule along the axle line. */
export interface ChassisShape {
  center: Vec2;
  /** Unit vector from the left wheel to the right one, and the kart's up (a quarter turn). */
  along: Vec2;
  up: Vec2;
  /** Half the straight part's length, and the capsule's radius (half its thickness). */
  halfLength: number;
  radius: number;
}

export interface KartsState {
  karts: Kart[];
  /** Whether each player held down (the crouch input) last step: a fresh press gets in or out. */
  downHeld: Map<string, boolean>;
  /** Jump held last step, per driver: a fresh press hops. */
  jumpHeld: Map<string, boolean>;
  /** `<kart id>:<player id>` → sim time that kart may hit that blob again (K7). */
  hitCooldowns: Map<string, number>;
}
