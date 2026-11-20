/**
 * Level objects (level-objects D5): a recipe of parts built from parameters. Each part is one
 * level-file shape (rect / polygon / circle) made of a catalog material and colour, so placed
 * objects become ordinary terrain pieces and every terrain system applies to them.
 */
import type { Rect, Shape2D, Vec2 } from "@/shared/types/gameGeometry.types";
import type { PhysicsBodySpec } from "@/shared/types/physicsBody.types";

export type { ObjectPanelColor, PhysicsBodySpec } from "@/shared/types/physicsBody.types";

/** What a part is to its object (for tests, docs and the later physics lap). */
export type ObjectPartRole = "trunk" | "branch" | "leaves" | "cap" | "nut";

export interface ObjectPart {
  shape: Shape2D;
  /** Catalog material ID: how the part behaves (burns, freezes, craters). */
  materialId: string;
  /** Catalog colour ID: how it looks. */
  colorId: string;
  part: ObjectPartRole;
}

/** Width ÷ height range a variant keeps; an author's box is clamped into it. */
export interface AspectRange {
  min: number;
  max: number;
}

export interface ObjectVariant {
  /** Stable kebab-case ID (never renamed once shipped). */
  id: string;
  label: string;
  aspect: AspectRange;
  /** One line for level authors: what it is made of and how that reacts. */
  madeOf: string;
  /** Parts filling `box` (world units, y down), standing on its bottom edge. Pure for a given `random`. */
  build: (box: Rect, random: () => number) => ObjectPart[];
}

/** Shared fields of every recipe kind; `V` is its variant shape. */
interface ObjectRecipeBase<V> {
  /** Stable kebab-case kind ID, the level file's `data-kind`. */
  kind: string;
  label: string;
  /** Height range in world units every variant accepts. */
  height: { min: number; max: number };
  defaultVariant: string;
  variants: readonly V[];
}

/**
 * The two object classes (owner, level-objects Decisions "object classes"): a **terrain** object
 * compiles to terrain pieces (craters, burns and freezes per sample, never moves); a **physics**
 * object is one moving body whose state (burning, frozen) is always the whole object's.
 */
export type ObjectClass = "terrain" | "physics";

export interface TerrainObjectRecipe extends ObjectRecipeBase<ObjectVariant> {
  objectClass: "terrain";
}

/** A physics variant: the same author-facing fields as a terrain variant, plus its body. */
export interface PhysicsObjectVariant {
  id: string;
  label: string;
  aspect: AspectRange;
  madeOf: string;
  body: PhysicsBodySpec;
}

export interface PhysicsObjectRecipe extends ObjectRecipeBase<PhysicsObjectVariant> {
  objectClass: "physics";
}

export type ObjectRecipe = TerrainObjectRecipe | PhysicsObjectRecipe;

/**
 * A turn of the placed object about a world point (SVG `rotate(degrees cx cy)`, clockwise in
 * y-down coordinates): the object is built upright in its box, then turned as a whole, so its
 * "up" follows the box's top (level-orbit D1).
 */
export interface ObjectRotation {
  degrees: number;
  about: Vec2;
}

/** A request to place an object: what the level file says, before clamping. */
export interface ObjectPlacementRequest {
  kind: string;
  /** Omitted = a seeded pick among the kind's variants. */
  variant?: string;
  box: Rect;
  seed: number;
  /** Omitted = upright. */
  rotation?: ObjectRotation;
}

/** A placed object: the box and variant actually used, its parts, and each correction made. */
export type ObjectPlacement =
  | { ok: false; reason: "unknown-kind" }
  | {
      ok: true;
      kind: string;
      objectClass: ObjectClass;
      variant: string;
      box: Rect;
      seed: number;
      /** Present when the object is turned (the box is the upright box before the turn). */
      rotation?: ObjectRotation;
      /** Terrain parts (empty for a physics object, which the match spawns as a body). */
      parts: ObjectPart[];
      /** Readable corrections (unknown variant, clamped size), for import warnings. */
      notes: string[];
    };

/** The registry as plain JSON (the kit's catalog.json `object` list). */
export interface ExportedObjectRecipe {
  kind: string;
  objectClass: ObjectClass;
  label: string;
  height: { min: number; max: number };
  defaultVariant: string;
  variants: { id: string; label: string; aspect: AspectRange; madeOf: string }[];
}
