/**
 * Level objects (level-objects D5): a recipe of parts built from parameters. Each part is one
 * level-file shape (rect / polygon / circle) made of a catalog material and colour, so placed
 * objects become ordinary terrain pieces and every terrain system applies to them.
 */
import type { Rect, Shape2D } from "@/shared/types/gameGeometry.types";

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

export interface ObjectRecipe {
  /** Stable kebab-case kind ID, the level file's `data-kind`. */
  kind: string;
  label: string;
  /** Height range in world units every variant accepts. */
  height: { min: number; max: number };
  defaultVariant: string;
  variants: readonly ObjectVariant[];
}

/** A request to place an object: what the level file says, before clamping. */
export interface ObjectPlacementRequest {
  kind: string;
  /** Omitted = a seeded pick among the kind's variants. */
  variant?: string;
  box: Rect;
  seed: number;
}

/** A placed object: the box and variant actually used, its parts, and each correction made. */
export type ObjectPlacement =
  | { ok: false; reason: "unknown-kind" }
  | {
      ok: true;
      kind: string;
      variant: string;
      box: Rect;
      seed: number;
      parts: ObjectPart[];
      /** Readable corrections (unknown variant, clamped size), for import warnings. */
      notes: string[];
    };

/** The registry as plain JSON (the kit's catalog.json `object` list). */
export interface ExportedObjectRecipe {
  kind: string;
  label: string;
  height: { min: number; max: number };
  defaultVariant: string;
  variants: { id: string; label: string; aspect: AspectRange; madeOf: string }[];
}
