import type { Vec2 } from "@/shared/types/gameGeometry.types";
import type { RoundBodySpec } from "@/shared/types/physicsBody.types";

/**
 * Whole-object state (owner, level-objects "object classes"): a physics object is burning, frozen
 * or neither as a whole, never in part.
 */
export type WholeObjectState =
  | { kind: "none" }
  /** `bySlot`: who lit it (a burning blob passing it on), credited when it lights a blob. */
  | { kind: "burning"; since: number; bySlot: number | null }
  | { kind: "frozen"; since: number };

/** One moving round body a level placed (a ball, a kart's wheel). Centre position, world units, y down. */
export interface PhysicsObject {
  /** Stable for the match: `object-<ordinal>` in level order. */
  id: string;
  kind: string;
  variant: string;
  body: RoundBodySpec;
  radius: number;
  /** Where it was placed and comes back to (centre). */
  home: Vec2;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Turn of the drawn ball, radians (rolling turns it; render only reads it). */
  angle: number;
  /** Touching terrain at the end of its last step. */
  grounded: boolean;
  /** Sim time it comes back, or null while in play. */
  goneUntil: number | null;
  state: WholeObjectState;
  /** Seconds of freeze beam gathered (frozen at `ice.blob.freezeSeconds`, like a blob). */
  chill: number;
  /** Sim time a freeze ray last reached it. */
  chilledAt: number;
  /** A moving part's speed it kept on leaving the part, taken off when it lands on one again. */
  heldCarry: Vec2 | null;
  /** Seconds it has rested on the ground almost still (it falls asleep after `SLEEP_AFTER_SECONDS`). */
  restSeconds: number;
  /** The terrain shape version under it when it fell asleep, or null while awake. */
  sleepShape: number | null;
}

/**
 * A moment of an object, for the renderer (squash, puffs) and sound: what happened, where, how
 * hard (0–1). `seq` grows by one per moment over the match, so a reader can tell new ones.
 */
export interface ObjectMoment {
  seq: number;
  /** `board`, `leave`, `hop`: a kart's own moments (kart lap; `objectId` is the kart's id). */
  kind:
    | "bounce"
    | "pop"
    | "back"
    | "caught"
    | "frozen"
    | "shatter"
    | "melt"
    | "board"
    | "leave"
    | "hop";
  objectId: string;
  at: Vec2;
  atSeconds: number;
  strength: number;
  /** Catalog sound of the moment ("none" = silent). */
  soundId: string;
}

export interface PhysicsObjectsState {
  objects: PhysicsObject[];
  /** Recent moments (kept `MOMENT_SECONDS`), oldest first. */
  moments: ObjectMoment[];
  /** Moments made over the match (the next one's `seq`). */
  momentCount: number;
}

/** A blob touching an object this step (after the response), for fire passing both ways. */
export interface ObjectBlobContact {
  object: PhysicsObject;
  playerId: string;
  /** Contact point, world units. */
  at: Vec2;
  /** The blob struck it in a dive (a hit: breaks a frozen object's ice). */
  dived: boolean;
}
