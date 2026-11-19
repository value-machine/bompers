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

function kindLines(recipe: ExportedObjectRecipe): string[] {
  return [
    `- ${code(recipe.kind)} (${recipe.label}): height ${code(recipe.height.min)}–${code(recipe.height.max)}; default variant ${code(recipe.defaultVariant)}. Variants:`,
    ...recipe.variants.map(variantLine),
  ];
}

/** The `object` row of the roles table. */
export function objectRoleRow(): string {
  const kinds = exportObjectCatalog().map((recipe) => code(recipe.kind));
  return `| \`object\` | \`<rect>\` | ≥ 0 | A ready-made object built inside the rect (§ 3 Objects): \`data-kind\` (${kinds.join(", ")}), optional \`data-variant\`, \`data-seed\`. It is solid ground made of catalog materials. \`fill="${OBJECT_PREVIEW_FILL}"\`. |`;
}

/** The "Objects" subsection of § 3. */
export function renderObjects(cell: number): string {
  const catalog = exportObjectCatalog();
  const example = catalog[0];
  const variant = example?.variants[1] ?? example?.variants[0];
  return [
    "### Objects (optional)",
    "",
    'Place ready-made objects with one `<rect data-role="object">` each. The game builds the object inside the rect from catalog materials, so it behaves like terrain: players stand on it, blasts crater its breakable parts, fire burns its cardboard parts away, cold freezes its trunk and leaves.',
    "",
    "- The object stands on the rect's **bottom centre** and fills its **height**: draw the rect with its bottom edge on a surface. The width is the object's spread; it is kept inside the variant's width range below.",
    "- `data-kind` — REQUIRED, one kind below. `data-variant` — optional; leave it out for a varied pick. `data-seed` — optional whole number; the same seed gives the same shape. Without a seed every object still differs and looks the same on every load; give the rect an `id` to keep its shape when you add objects before it.",
    `- Sizes outside a kind's height range or a variant's width range are clamped (with a warning). Snap \`x\`, \`y\`, \`width\`, \`height\` to multiples of \`${cell}\`; keep \`data-cell-size\` at \`${cell}\` so thin branches stay solid.`,
    "- Like terrain, later shapes paint over earlier ones: put objects after the ground they stand on. An object inside a `<g data-motion>` moves with that part. Spawns go beside or on top of objects, never inside one.",
    "",
    ...catalog.flatMap(kindLines),
    "",
    "```svg",
    `<rect data-role="object" data-kind="${example?.kind ?? "tree"}" data-variant="${variant?.id ?? ""}" x="800" y="400" width="120" height="208" fill="${OBJECT_PREVIEW_FILL}" />`,
    "```",
  ].join("\n");
}
