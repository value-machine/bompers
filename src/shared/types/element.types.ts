/**
 * The elements of the game and how things react to them (owner, mover-materials D1: reactions
 * come from tables). An element is what a weapon's beam, a fire or a frost is made of; `cold` is
 * the element, `ice` the material and the frozen look.
 */
export type ElementId = "fire" | "cold";

/**
 * What a material does when fire meets it: `burns` = fuel, the fire spreads through it and
 * burns it away; `scorches` = the fire stops and leaves a scorch; `blocks` = the fire stops;
 * `douses` = the fire stops and fuel touching it never catches, and it puts a burning blob out.
 */
export type FireReaction = "burns" | "scorches" | "blocks" | "douses";

/** What a material does when cold meets it: `freezes` = it takes frost; `blocks` = the cold stops. */
export type ColdReaction = "freezes" | "blocks";

/** A material's row of the material × element table: one reaction per element. */
export interface MaterialReactions {
  fire: FireReaction;
  cold: ColdReaction;
}

/**
 * How two elements react where they meet. `cancel`: they end each other. Between two beams that
 * is the steam wall (`beamClash`); on the ground fire stops at frost, freezing puts a fire out
 * and the torch thaws frost (the fire and ice features); on a blob a burn and a chill take each
 * other off (the match).
 */
export type ElementPairReaction = "cancel";

/** The element × element table: a row per element, a reaction per element it reacts with. */
export type ElementPairs = Readonly<Record<string, Readonly<Record<string, ElementPairReaction>>>>;
