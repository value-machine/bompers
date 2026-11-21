import type {
  PhysicsObjectRecipe,
  PhysicsObjectVariant,
} from "@/features/level-objects/types/levelObject.types";

/**
 * The kart recipe, the second physics object (owner picks, kart Q1: the go-kart only; options
 * page "Car Options"). Each variant is one data line; another car is one more line here, no code.
 * A kart is twice as long as it is tall (64 × 32 by default) and stands on its box's bottom
 * centre: two wheels at the bottom, a low open chassis held above them on a spring.
 */
const LONG = { min: 2, max: 2 };

const VARIANTS: readonly PhysicsObjectVariant[] = [
  {
    id: "go-kart",
    label: "Go-kart",
    aspect: LONG,
    madeOf:
      "a low open kart on two wheels (2 blobs' weight), springy; a blob presses down beside it to get in and drives it (jump hops), pressing down again gets out; it rams blobs at speed, burns as a whole and pops, then comes back",
    body: {
      shape: "kart",
      mass: 2,
      restitution: 0.25,
      rollDrag: 0.6,
      burnSeconds: 4,
      bounceSound: "land",
      wheelRadius: 0.25,
      wheelSpread: 0.33,
      chassisHeight: 0.38,
      driveSpeed: 520,
      driveAccel: 900,
      hopSpeed: 560,
      springRate: 30,
      springDamping: 0.35,
      body: "sun",
      trim: "rose",
    },
  },
];

export const KART_RECIPE: PhysicsObjectRecipe = {
  kind: "kart",
  objectClass: "physics",
  label: "Kart",
  // Height 32 (64 long, owner Q1) to 48 (96 long); the width is twice the height.
  height: { min: 32, max: 48 },
  defaultVariant: "go-kart",
  variants: VARIANTS,
};
