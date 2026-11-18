import type { ElementId, ElementPairReaction, ElementPairs } from "@/shared/types/element.types";

/**
 * The element × element table (owner, mover-materials D1; first row from beam-clash D2): which
 * pairs of elements react and how. A pair without an entry does not react, as two of the same
 * element do not. Adding an element that reacts with another is a row here.
 */
export const ELEMENT_PAIRS: Readonly<
  Record<ElementId, Partial<Record<ElementId, ElementPairReaction>>>
> = {
  fire: { cold: "cancel" },
  cold: { fire: "cancel" },
};

/** The reaction of two elements, or null when they do not react. */
export const elementPairReaction = (
  a: string,
  b: string,
  pairs: ElementPairs = ELEMENT_PAIRS as ElementPairs
): ElementPairReaction | null => pairs[a]?.[b] ?? null;
