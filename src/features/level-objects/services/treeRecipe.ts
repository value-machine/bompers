import type { Rect, Vec2 } from "@/shared/types/gameGeometry.types";
import { randomBetween as between } from "@/shared/utils/seededRandom";
import {
  MIN_PART_THICKNESS,
  circlePart,
  insideLocalBox,
  limbPart,
  polygonPart,
  toBox,
  type PartLook,
} from "@/features/level-objects/services/objectParts";
import type {
  ObjectPart,
  ObjectRecipe,
  ObjectVariant,
} from "@/features/level-objects/types/levelObject.types";

/**
 * The tree recipe (owner picks, level-objects D1, D4): five variants drawn on the options page
 * "Level Tree Options". Living trunks are earth (crater, only scorch), leaves and needles are
 * cardboard (burn away), snow caps are ice (fire next to them never catches), the dead tree is
 * cardboard throughout. Each build fills its box and stands on the box's bottom centre.
 */

const TRUNK: PartLook = { materialId: "earth", colorId: "bark", part: "trunk" };
const BRANCH: PartLook = { ...TRUNK, part: "branch" };
const LEAVES: PartLook = { materialId: "cardboard", colorId: "moss", part: "leaves" };
const NEEDLES: PartLook = { materialId: "cardboard", colorId: "mint", part: "leaves" };
const SNOW: PartLook = { materialId: "ice", colorId: "frost", part: "cap" };
const PALM_TRUNK: PartLook = { materialId: "earth", colorId: "cardboard", part: "trunk" };
const NUT: PartLook = { materialId: "cardboard", colorId: "clay", part: "nut" };
const DEAD_WOOD: PartLook = { materialId: "cardboard", colorId: "bark", part: "trunk" };
const DEAD_LIMB: PartLook = { ...DEAD_WOOD, part: "branch" };

type Random = () => number;
interface Size {
  w: number;
  h: number;
}

const baseOf = (box: Rect): Vec2 => ({ x: box.x + box.w / 2, y: box.y + box.h });
const side = (random: Random): number => (random() < 0.5 ? -1 : 1);

/** A trunk tapering from `bottom` to `top` width, `height` tall, from the base. */
const taperedTrunk = (dims: { bottom: number; top: number; height: number }, look: PartLook) =>
  polygonPart(
    [
      { x: -dims.bottom / 2, y: 0 },
      { x: dims.bottom / 2, y: 0 },
      { x: dims.top / 2, y: -dims.height },
      { x: -dims.top / 2, y: -dims.height },
    ],
    look
  );

// ── Oak ──────────────────────────────────────────────────────────────────────

/** Leaf circles round a centre; the cluster spans ≤ 3.4 × `r` wide and 1.47 × `r` above the centre. */
function oakCanopy(centre: Vec2, r: number, random: Random): ObjectPart[] {
  const parts = [circlePart(centre, r, LEAVES)];
  const count = 4 + Math.floor(random() * 2);
  for (let i = 0; i < count; i++) {
    const a = Math.PI * (1.05 + (i / (count - 1)) * 0.9) + between(random, -0.05, 0.05);
    const d = r * between(random, 0.55, 0.75);
    const at = { x: centre.x + Math.cos(a) * d * 1.25, y: centre.y + Math.sin(a) * d };
    parts.push(circlePart(at, r * between(random, 0.5, 0.72), LEAVES));
  }
  return parts;
}

function buildOak({ w, h }: Size, random: Random): ObjectPart[] {
  const r = Math.min(w / 3.4, h * 0.28);
  const centre = { x: 0, y: -h + 1.47 * r };
  const tw = Math.max(MIN_PART_THICKNESS * 1.5, Math.min(w * 0.16, h * 0.12));
  const trunkTop = -centre.y;
  const lean = side(random) * Math.min(w * 0.32, r * 1.2);
  const branch = limbPart(
    {
      from: { x: 0, y: -trunkTop * 0.62 },
      to: { x: lean, y: -trunkTop * 0.95 },
      w0: tw * 0.5,
      w1: tw * 0.32,
    },
    BRANCH
  );
  const trunk = taperedTrunk({ bottom: tw * 1.4, top: tw * 0.85, height: trunkTop }, TRUNK);
  return [trunk, branch, ...oakCanopy(centre, r, random)];
}

// ── Pine ─────────────────────────────────────────────────────────────────────

interface Tier {
  y0: number;
  y1: number;
  half: number;
  lean: number;
  step: number;
}

function pineTiers({ w, h }: Size, random: Random): Tier[] {
  const count = h >= 240 ? 4 : 3;
  const base = -h * 0.16;
  const step = (base + h) / (count + 0.6);
  return Array.from({ length: count }, (_, i) => {
    const y0 = base - i * step * 0.95;
    const half = (w / 2) * between(random, 0.92, 1) * (1 - i / (count + 1.2));
    return { y0, y1: y0 - step * 1.65, half, lean: between(random, -0.04, 0.04) * w, step };
  });
}

const tierPart = (t: Tier): ObjectPart =>
  polygonPart(
    [
      { x: -t.half, y: t.y0 },
      { x: t.half, y: t.y0 },
      { x: t.lean * 0.3 + t.half * 0.12, y: t.y1 + t.step * 0.2 },
      { x: t.lean, y: t.y1 },
      { x: t.lean * 0.3 - t.half * 0.12, y: t.y1 + t.step * 0.2 },
    ],
    NEEDLES
  );

/** An ice cap over a tier's top, with a zig-zag lower edge. */
function capPart(t: Tier): ObjectPart {
  const bottom = t.y1 + (t.y0 - t.y1) * 0.42;
  const half = t.half * 0.42;
  const shoulder = t.y1 + (bottom - t.y1) * 0.6;
  const teeth = Array.from({ length: 6 }, (_, k) => {
    const j = 5 - k;
    return { x: t.lean * 0.4 - half + (2 * half * j) / 5, y: bottom + (j % 2 ? t.step * 0.12 : 0) };
  });
  return polygonPart(
    [
      { x: t.lean, y: t.y1 },
      { x: t.lean + t.half * 0.12 + half * 0.4, y: shoulder },
      ...teeth,
      { x: t.lean - t.half * 0.12 - half * 0.4, y: shoulder },
    ],
    SNOW
  );
}

function buildPine(size: Size, random: Random, snowy: boolean): ObjectPart[] {
  const tw = Math.max(MIN_PART_THICKNESS * 1.25, size.w * 0.14);
  const trunk = taperedTrunk({ bottom: tw, top: tw, height: size.h * 0.3 }, TRUNK);
  const tiers = pineTiers(size, random);
  const caps = snowy ? tiers.map(capPart) : [];
  return [trunk, ...tiers.map(tierPart), ...caps];
}

// ── Palm ─────────────────────────────────────────────────────────────────────

function palmTrunk(bend: number, h: number): { parts: ObjectPart[]; crown: Vec2 } {
  const r0 = Math.max(5, h * 0.055);
  const count = Math.max(6, Math.round(h / 14));
  const parts = [
    polygonPart(
      [
        { x: -r0, y: 0 },
        { x: r0, y: 0 },
        { x: r0, y: -r0 },
        { x: -r0, y: -r0 },
      ],
      PALM_TRUNK
    ),
  ];
  let crown = { x: 0, y: -r0 };
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    crown = { x: bend * t * t, y: -r0 - (h * 0.78 - r0) * t };
    parts.push(circlePart(crown, Math.max(5, h * (0.055 - 0.02 * t)), PALM_TRUNK));
  }
  return { parts, crown };
}

/** One drooping frond from the crown at angle `a` (π … 2π = the upper half), `len` long. */
function frondPart(crown: Vec2, frond: { a: number; len: number; width: number }): ObjectPart {
  const top: Vec2[] = [];
  const under: Vec2[] = [];
  for (let j = 0; j <= 6; j++) {
    const u = j / 6;
    const x = crown.x + Math.cos(frond.a) * frond.len * u;
    const y = crown.y + Math.sin(frond.a) * frond.len * u * 0.7 + frond.len * 0.55 * u * u;
    const half = frond.width * Math.sin(Math.PI * Math.min(1, u * 1.15 + 0.05));
    top.push({ x, y: y - half });
    under.unshift({ x, y: y + half * 0.6 });
  }
  return polygonPart([...top, ...under], LEAVES);
}

function buildPalm({ w, h }: Size, random: Random): ObjectPart[] {
  const len = Math.min(h * between(random, 0.32, 0.4), w * 0.42);
  const bend =
    side(random) * Math.max(0, Math.min(h * between(random, 0.18, 0.28), w / 2 - len - 6));
  const { parts, crown } = palmTrunk(bend, h);
  const count = 6 + Math.floor(random() * 2);
  const width = Math.max(5, h * 0.05);
  for (let i = 0; i < count; i++) {
    const a = Math.PI * (1 + i / (count - 1)) + between(random, -0.06, 0.06);
    parts.push(frondPart(crown, { a: Math.min(2 * Math.PI, Math.max(Math.PI, a)), len, width }));
  }
  const nut = Math.max(MIN_PART_THICKNESS / 2, h * 0.03);
  for (const s of [-1, 1]) {
    parts.push(circlePart({ x: crown.x + s * h * 0.035, y: crown.y + h * 0.04 }, nut, NUT));
  }
  return parts;
}

// ── Dead tree ────────────────────────────────────────────────────────────────

interface Limb {
  from: Vec2;
  angle: number;
  len: number;
  width: number;
  depth: number;
}

/** A limb and, while `depth` lasts, its 2–3 forks; every end is kept inside the box. */
function growLimb(limb: Limb, ctx: { size: Size; random: Random; parts: ObjectPart[] }): void {
  const w1 = Math.max(MIN_PART_THICKNESS, limb.width * 0.6);
  const raw = {
    x: limb.from.x + Math.cos(limb.angle) * limb.len,
    y: limb.from.y + Math.sin(limb.angle) * limb.len,
  };
  const to = insideLocalBox(raw, ctx.size, w1 / 2);
  ctx.parts.push(limbPart({ from: limb.from, to, w0: limb.width, w1 }, DEAD_LIMB));
  ctx.parts.push(circlePart(to, w1 / 2, DEAD_LIMB));
  if (limb.depth === 0) return;
  const forks = 2 + (ctx.random() < 0.35 ? 1 : 0);
  for (let i = 0; i < forks; i++) {
    growLimb(
      {
        from: to,
        angle: limb.angle + between(ctx.random, -0.7, 0.7),
        len: limb.len * between(ctx.random, 0.55, 0.75),
        width: w1,
        depth: limb.depth - 1,
      },
      ctx
    );
  }
}

function buildDead(size: Size, random: Random): ObjectPart[] {
  const tw = Math.max(MIN_PART_THICKNESS * 1.5, Math.min(size.w * 0.2, size.h * 0.11));
  const trunkH = size.h * 0.55;
  const parts = [taperedTrunk({ bottom: tw * 1.4, top: tw * 0.8, height: trunkH }, DEAD_WOOD)];
  const ctx = { size, random, parts };
  const count = 2 + (random() < 0.5 ? 1 : 0);
  for (let i = 0; i < count; i++) {
    growLimb(
      {
        from: { x: 0, y: -trunkH + tw * 0.3 },
        angle: -Math.PI / 2 + (i - (count - 1) / 2) * 0.75 + between(random, -0.15, 0.15),
        len: size.h * between(random, 0.22, 0.3),
        width: tw * 0.75,
        depth: 2,
      },
      ctx
    );
  }
  return parts;
}

// ── Recipe ───────────────────────────────────────────────────────────────────

const placed =
  (build: (size: Size, random: Random) => ObjectPart[]) =>
  (box: Rect, random: Random): ObjectPart[] =>
    toBox(build({ w: box.w, h: box.h }, random), baseOf(box));

const VARIANTS: readonly ObjectVariant[] = [
  {
    id: "oak",
    label: "Round oak",
    aspect: { min: 0.6, max: 1.2 },
    madeOf:
      "earth trunk in bark colour (craters, only scorches) under a cardboard canopy in moss (burns away)",
    build: placed(buildOak),
  },
  {
    id: "pine",
    label: "Pine",
    aspect: { min: 0.35, max: 0.75 },
    madeOf: "earth trunk in bark colour under stacked cardboard needle tiers in mint (burn away)",
    build: placed((size, random) => buildPine(size, random, false)),
  },
  {
    id: "snowy-pine",
    label: "Snowy pine",
    aspect: { min: 0.35, max: 0.75 },
    madeOf: "a pine with ice caps in frost on each tier (needles touching ice never catch fire)",
    build: placed((size, random) => buildPine(size, random, true)),
  },
  {
    id: "palm",
    label: "Palm",
    aspect: { min: 0.5, max: 1.1 },
    madeOf:
      "bending earth trunk in cardboard colour, cardboard fronds in moss and two nuts (burn away)",
    build: placed(buildPalm),
  },
  {
    id: "dead",
    label: "Dead tree",
    aspect: { min: 0.5, max: 1.1 },
    madeOf: "bare cardboard trunk and branches in bark colour: one spark burns the whole tree",
    build: placed(buildDead),
  },
];

export const TREE_RECIPE: ObjectRecipe = {
  kind: "tree",
  label: "Tree",
  // 96 keeps every part at least two samples thick; 480 is a third of a 1440-tall world (D11).
  height: { min: 96, max: 480 },
  defaultVariant: "oak",
  variants: VARIANTS,
};
