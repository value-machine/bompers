import {
  CATALOG_DEFAULTS,
  hasCatalogEntry,
  itemUseOf,
  type ContentKind,
  type ItemUse,
} from "@/features/content-catalog/api/contentCatalogApi";
import type { TerrainPiece } from "@/features/level/api/levelApi";
import { addWarning, type LevelIssueLog } from "@/features/level-file/services/levelFileIssues";
import { CATALOG_ID_RE } from "@/features/level-file/services/levelFileRoot";
import type { LevelRole, RoleElement } from "@/features/level-file/types/levelFile.types";

/**
 * Role elements of a level root (LEVEL_FORMAT § 5–6): which elements count (W1 unknown role,
 * W2 wrong element, W3 transform, W7 duplicate id, W10 unknown data-*), and their catalog
 * references (W4 unknown or malformed ID, W11 item of the other point role → role default).
 */
const TERRAIN_TAGS = ["rect", "polygon", "circle"] as const;

const ROLE_RULES: Readonly<
  Record<LevelRole, { tags: readonly string[]; attrs: readonly string[] }>
> = {
  terrain: {
    tags: TERRAIN_TAGS,
    attrs: ["data-material", "data-color", "data-effect", "data-sound", "data-behavior"],
  },
  spawn: { tags: ["circle"], attrs: ["data-behavior"] },
  drop: { tags: ["circle"], attrs: ["data-items", "data-behavior"] },
  collectible: { tags: ["circle"], attrs: ["data-item", "data-behavior"] },
  bounds: { tags: ["rect"], attrs: [] },
};

const COMMON_ATTRS = ["data-role", "data-label"];

const isLevelRole = (role: string): role is LevelRole =>
  Object.prototype.hasOwnProperty.call(ROLE_RULES, role);

function nameOf(el: Element, role: string, ordinal: number): string {
  const ref = el.getAttribute("id") || el.getAttribute("data-label");
  return ref ? `${role} "${ref}"` : `${role} #${ordinal}`;
}

function hasTransform(el: Element, root: Element): boolean {
  for (let node: Element | null = el; node && node !== root; node = node.parentElement) {
    if (node.hasAttribute("transform")) return true;
  }
  return false;
}

/** W2 / W3: false when the element is skipped. */
function passesStructure(item: RoleElement, root: Element, log: LevelIssueLog): boolean {
  const { tags } = ROLE_RULES[item.role];
  const tag = item.el.localName;
  if (!tags.includes(tag)) {
    const allowed = tags.map((t) => `<${t}>`).join(", ");
    addWarning(log, "W2", `${item.name} is a <${tag}>; ${item.role} must be ${allowed}. Ignored.`);
    return false;
  }
  if (hasTransform(item.el, root)) {
    addWarning(
      log,
      "W3",
      `${item.name} has a transform (on itself or a parent group); transforms are not allowed. Ignored.`
    );
    return false;
  }
  return true;
}

function warnUnknownAttrs(item: RoleElement, log: LevelIssueLog): void {
  const known = [...COMMON_ATTRS, ...ROLE_RULES[item.role].attrs];
  for (const { name } of Array.from(item.el.attributes)) {
    if (name.startsWith("data-") && !known.includes(name)) {
      addWarning(log, "W10", `${item.name}: ${name} is not used on ${item.role}; ignored.`);
    }
  }
}

interface CollectContext {
  root: Element;
  log: LevelIssueLog;
  ordinals: Map<string, number>;
  seenIds: Set<string>;
}

/** W7: a repeated id is dropped; the element is then named by its ordinal. */
function claimId(item: RoleElement, ordinal: number, ctx: CollectContext): void {
  const id = item.el.getAttribute("id");
  if (!id) return;
  if (!ctx.seenIds.has(id)) {
    ctx.seenIds.add(id);
    return;
  }
  item.name = `${item.role} #${ordinal}`;
  addWarning(
    ctx.log,
    "W7",
    `Duplicate id "${id}" on ${item.name}; the later element loses its id.`
  );
}

function readRoleElement(el: Element, ctx: CollectContext): RoleElement | null {
  const role = el.getAttribute("data-role") ?? "";
  const ordinal = (ctx.ordinals.get(role) ?? 0) + 1;
  ctx.ordinals.set(role, ordinal);
  if (!isLevelRole(role)) {
    addWarning(
      ctx.log,
      "W1",
      `<${el.localName}> #${ordinal} has unknown data-role "${role}"; ignored.`
    );
    return null;
  }
  const item: RoleElement = { el, role, name: nameOf(el, role, ordinal) };
  if (!passesStructure(item, ctx.root, ctx.log)) return null;
  claimId(item, ordinal, ctx);
  warnUnknownAttrs(item, ctx.log);
  return item;
}

/** Role elements in document order that the game reads; the rest is logged and skipped. */
export function collectRoleElements(root: Element, log: LevelIssueLog): RoleElement[] {
  const ctx: CollectContext = { root, log, ordinals: new Map(), seenIds: new Set() };
  return Array.from(root.querySelectorAll("[data-role]")).flatMap(
    (el) => readRoleElement(el, ctx) ?? []
  );
}

interface RefSpec {
  attr: string;
  kind: ContentKind;
  /** What the game uses instead, for the warning text. */
  instead: string;
}

/** A known catalog ID, or undefined (absent, or W4 when malformed / unknown). */
function checkRef(
  item: RoleElement,
  ref: { spec: RefSpec; raw: string | null },
  log: LevelIssueLog
): string | undefined {
  const { spec, raw } = ref;
  if (raw === null) return undefined;
  const id = raw.trim();
  if (CATALOG_ID_RE.test(id) && hasCatalogEntry(spec.kind, id)) return id;
  const problem = CATALOG_ID_RE.test(id)
    ? `unknown ${spec.kind} "${id}"`
    : `${spec.attr}="${raw}" is not a valid ID (lowercase kebab-case)`;
  addWarning(log, "W4", `${item.name}: ${problem}; ${spec.instead}.`);
  return undefined;
}

const readRef = (item: RoleElement, spec: RefSpec, log: LevelIssueLog): string | undefined =>
  checkRef(item, { spec, raw: item.el.getAttribute(spec.attr) }, log);

/** Terrain piece references; the material falls back to the default, the colour to the material's. */
export function readTerrainRefs(
  item: RoleElement & { role: "terrain" },
  log: LevelIssueLog
): Omit<TerrainPiece, "shape"> {
  const fallback = CATALOG_DEFAULTS.material;
  const materialId =
    readRef(
      item,
      { attr: "data-material", kind: "material", instead: `using "${fallback}"` },
      log
    ) ?? fallback;
  const colorId = readRef(
    item,
    { attr: "data-color", kind: "color", instead: "using the material's" },
    log
  );
  const effectId = readRef(
    item,
    { attr: "data-effect", kind: "effect", instead: "using the material's" },
    log
  );
  const soundId = readRef(
    item,
    { attr: "data-sound", kind: "sound", instead: "using the material's" },
    log
  );
  const behaviorId = readRef(
    item,
    { attr: "data-behavior", kind: "behavior", instead: "left out" },
    log
  );
  return {
    materialId,
    ...(colorId !== undefined && { colorId }),
    ...(effectId !== undefined && { effectId }),
    ...(soundId !== undefined && { soundId }),
    ...(behaviorId !== undefined && { behaviorId }),
  };
}

/** Points carry no behaviour in the engine yet; an unknown one is still reported. */
export function checkPointBehavior(item: RoleElement, log: LevelIssueLog): void {
  readRef(item, { attr: "data-behavior", kind: "behavior", instead: "left out" }, log);
}

/** An item ID the point's role can use, or undefined (W4 unknown, W11 item of the other role). */
function checkItem(
  item: RoleElement,
  ref: { spec: RefSpec; raw: string | null; use: ItemUse },
  log: LevelIssueLog
): string | undefined {
  const id = checkRef(item, ref, log);
  if (id === undefined) return undefined;
  const actual = itemUseOf(id);
  if (actual === ref.use) return id;
  addWarning(
    log,
    "W11",
    `${item.name}: "${id}" is a ${actual} item, not a ${ref.use} item; ${ref.spec.instead}.`
  );
  return undefined;
}

/** `data-items` of a drop point: known drop items, else the default drop items. */
export function readDropItems(item: RoleElement, log: LevelIssueLog): string[] {
  const raw = item.el.getAttribute("data-items");
  if (raw === null) return [...CATALOG_DEFAULTS.items.drop];
  const spec: RefSpec = { attr: "data-items", kind: "item", instead: "left out" };
  const known = raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => checkItem(item, { spec, raw: id, use: "drop" }, log))
    .filter((id): id is string => id !== undefined);
  if (known.length > 0) return known;
  const fallback = CATALOG_DEFAULTS.items.drop.join(" ");
  addWarning(log, "W4", `${item.name}: no known item in data-items; using "${fallback}".`);
  return [...CATALOG_DEFAULTS.items.drop];
}

/** `data-item` of a collectible spawn when it is a collectible item, else the default collectible. */
export function readCollectibleItem(item: RoleElement, log: LevelIssueLog): string {
  const fallback = CATALOG_DEFAULTS.items.collectible;
  const spec: RefSpec = { attr: "data-item", kind: "item", instead: `using "${fallback}"` };
  const raw = item.el.getAttribute(spec.attr);
  return checkItem(item, { spec, raw, use: "collectible" }, log) ?? fallback;
}
