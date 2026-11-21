import {
  exportObjectCatalog,
  type ExportedObjectRecipe,
} from "@/features/level-objects/api/levelObjectsApi";

/**
 * Level-prompt lines for placed objects (level-objects D5), generated from the object registry so
 * a new recipe shows up in the prompt with no prompt edit. Per level-direction D1 they say only
 * what an author places or sizes: kinds, variants, size ranges, what each is made of. Pure.
 */

/** Suggested preview `fill` for an object rect (the game draws the object, not the rect). */
export const OBJECT_PREVIEW_FILL = "#5f8f3e";

const code = (s: string | number): string => `\`${s}\``;

const variantLine = (variant: ExportedObjectRecipe["variants"][number]): string =>
  `  - ${code(variant.id)} (${variant.label}): width ${variant.aspect.min}–${variant.aspect.max} × height; ${variant.madeOf}.`;

/** What each object class is to an author (owner, level-objects "object classes"). */
const CLASS_NOTE: Record<ExportedObjectRecipe["objectClass"], string> = {
  terrain: "terrain object: solid ground that never moves",
  physics: "physics object: moves; keep the rect inside the variant's width range below",
};

function kindLines(recipe: ExportedObjectRecipe): string[] {
  return [
    `- ${code(recipe.kind)} (${recipe.label}, ${CLASS_NOTE[recipe.objectClass]}): height ${code(recipe.height.min)}–${code(recipe.height.max)}; default variant ${code(recipe.defaultVariant)}. Variants:`,
    ...recipe.variants.map(variantLine),
  ];
}

/** The `object` row of the roles table. */
export function objectRoleRow(): string {
  const kinds = exportObjectCatalog().map((recipe) => code(recipe.kind));
  return `| \`object\` | \`<rect>\` | ≥ 0 | A ready-made object built inside the rect (§ 3 Objects): \`data-kind\` (${kinds.join(", ")}), optional \`data-variant\`, \`data-seed\`. A terrain object is solid ground made of catalog materials; a physics object (a ball, a kart) moves. \`fill="${OBJECT_PREVIEW_FILL}"\`. |`;
}

/**
 * Example rects: the registry's first terrain kind, then one per physics kind at its smallest
 * height and narrowest width (a 48 ball would be 32 here; every rect rests on ground whose top is
 * y = 608, the tree's ground), side by side.
 */
function exampleLines(catalog: readonly ExportedObjectRecipe[]): string[] {
  const terrain = catalog.find((recipe) => recipe.objectClass === "terrain");
  const lines: string[] = [];
  if (terrain) {
    const variant = terrain.variants[1] ?? terrain.variants[0];
    lines.push(
      `<rect data-role="object" data-kind="${terrain.kind}" data-variant="${variant?.id ?? ""}" x="800" y="400" width="120" height="208" fill="${OBJECT_PREVIEW_FILL}" />`
    );
  }
  let x = 1000;
  for (const physics of catalog.filter((recipe) => recipe.objectClass === "physics")) {
    const variant = physics.variants.find((candidate) => candidate.id === physics.defaultVariant);
    // A ball shows at 48 (owner, Ball Options); every other kind at its smallest height.
    const h = physics.kind === "ball" ? 48 : physics.height.min;
    const w = h * (variant?.aspect.min ?? 1);
    lines.push(
      `<rect data-role="object" data-kind="${physics.kind}" data-variant="${physics.defaultVariant}" x="${x}" y="${608 - h}" width="${w}" height="${h}" fill="${OBJECT_PREVIEW_FILL}" />`
    );
    x += w + 32;
  }
  return lines;
}

/** The "Objects" subsection of § 3. */
export function renderObjects(cell: number): string {
  const catalog = exportObjectCatalog();
  return [
    "### Objects (optional)",
    "",
    'Place ready-made objects with one `<rect data-role="object">` each. There are two classes:',
    "",
    "- **Terrain objects** (trees): the game builds the object inside the rect from catalog materials, so it behaves like terrain: players stand on it, blasts crater its breakable parts, fire burns its cardboard parts away, cold freezes its trunk and leaves. It never moves (except inside a moving part).",
    "- **Physics objects** (balls): one moving body. It falls, bounces, rolls downhill and rides moving parts; blobs bump it and blasts and headbutts knock it away. Fire and frost always take the whole object (a burning ball sets blobs it touches alight, a frozen one slides). It is never cut or chipped. If it leaves the arena or burns through, it comes back at its spot after 3 s. Players can't stand on it like ground: it gives way.",
    "- **Karts** (a physics object players drive): a blob standing beside a kart presses down to get in and down again to get out; left and right drive, jump hops, and the driver keeps firing its weapon. Other blobs push it, stand on it and blast it; a kart driven fast into a blob knocks off a chunk. Give a kart a flat run of at least 4 kart lengths and keep it out of narrow gaps.",
    "",
    "- The object stands on the rect's **bottom centre** and fills its **height**: draw the rect with its bottom edge on a surface. For a terrain object the width is its spread, kept inside the variant's width range below; a physics ball's rect is a square whose side is the ball's diameter, a kart's rect is twice as wide as it is tall (64 × 32).",
    "- `data-kind` — REQUIRED, one kind below. `data-variant` — optional; leave it out for a varied pick. `data-seed` — optional whole number; the same seed gives the same shape. Without a seed every object still differs and looks the same on every load; give the rect an `id` to keep its shape when you add objects before it.",
    `- Sizes outside a kind's height range or a variant's width range are clamped (with a warning). Snap \`x\`, \`y\`, \`width\`, \`height\` to multiples of \`${cell}\`; keep \`data-cell-size\` at \`${cell}\` so thin branches stay solid.`,
    "- Like terrain, later shapes paint over earlier ones: put terrain objects after the ground they stand on. A terrain object inside a `<g data-motion>` moves with that part. Spawns go beside or on top of objects, never inside one; leave a physics object room to roll.",
    '- Rotating a terrain object (optional): objects stand upright by default. To rotate one, add `transform="rotate(a cx cy)"` to the object rect itself (degrees, clockwise, about the point `cx cy`; the only transform allowed). The object is built upright in the rect and the whole object is rotated with it. A physics object ignores the rotation (it turns as it rolls).',
    "",
    ...catalog.flatMap(kindLines),
    "",
    "```svg",
    ...exampleLines(catalog),
    "```",
  ].join("\n");
}
