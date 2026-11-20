import type {
  PhysicsObjectRecipe,
  PhysicsObjectVariant,
} from "@/features/level-objects/types/levelObject.types";

/**
 * The ball recipe, the first physics object (owner picks, physics-objects Q1: the beach ball
 * only; options page "Ball Options"). Each variant is one data line; a new ball (the bowling, hay
 * and gum balls shown on the page) is one more line here, no code. A ball is round: its box is
 * square (width = height = diameter) and it rests on the box's bottom centre.
 */
const ROUND = { min: 1, max: 1 };

const VARIANTS: readonly PhysicsObjectVariant[] = [
  {
    id: "beach",
    label: "Beach ball",
    aspect: ROUND,
    madeOf:
      "light and bouncy (half a blob's weight); rolls downhill, rides moving parts, blobs and blasts knock it around; burns as a whole and pops, then comes back",
    body: {
      shape: "ball",
      mass: 0.5,
      restitution: 0.7,
      rollDrag: 0.25,
      burnSeconds: 3,
      bounceSound: "tumble-bounce",
      panels: ["cream", "rose", "cream", "frost", "cream", "sun"],
    },
  },
];

export const BALL_RECIPE: PhysicsObjectRecipe = {
  kind: "ball",
  objectClass: "physics",
  label: "Ball",
  // Diameter: 32 (a little more than a blob, 28) to 96; the beach ball on the options page is 48.
  height: { min: 32, max: 96 },
  defaultVariant: "beach",
  variants: VARIANTS,
};
