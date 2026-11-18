import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import { isWeaponItemId } from "@/shared/config/weaponItems";
import {
  DEFAULT_LEVEL_SETTINGS,
  LEVEL_FORMAT_VERSION,
  type LevelMeta,
  type LevelSettings,
} from "@/features/level/api/levelApi";
import { parsePlainNumber } from "@/features/level-file/services/levelFileGeometry";
import {
  addError,
  addWarning,
  type LevelIssueLog,
} from "@/features/level-file/services/levelFileIssues";
import {
  migrateLevelRoot,
  type MigrationOptions,
} from "@/features/level-file/services/levelFileMigrations";

/** Root `<svg data-level-format>` of a level file: version, world size, metadata, settings. */
export const UNTITLED_LEVEL = "Untitled level";
export const CATALOG_ID_RE = /^[a-z][a-z0-9-]{0,63}$/;
const ROOT_SELECTOR = "svg[data-level-format]";

/** E1: no root rejects the file; W15: of several roots, the first is the level. */
export function findLevelRoot(doc: Document, log: LevelIssueLog): Element | null {
  const roots = doc.querySelectorAll(ROOT_SELECTOR);
  if (roots.length === 0) {
    addError(
      log,
      "E1",
      "No level found: the file needs one <svg> with a data-level-format attribute."
    );
    return null;
  }
  if (roots.length > 1) {
    addWarning(
      log,
      "W15",
      `Found ${roots.length} <svg data-level-format> elements; using the first, the others are ignored.`
    );
  }
  return roots[0] ?? null;
}

/**
 * The file's format version. W16: anything but a whole number ≥ 1 reads as the game's own
 * version, unless it is a number above it (then it stays newer, E2: never guessed at, § 8).
 */
function readFormatVersion(raw: string, toVersion: number, log: LevelIssueLog): number {
  const text = raw.trim();
  if (/^\d+$/.test(text) && Number(text) >= 1) return Number(text);
  const number = parsePlainNumber(text);
  if (number !== null && number > toVersion) return Math.ceil(number);
  addWarning(
    log,
    "W16",
    `data-level-format="${raw}" is not a format version (a whole number ≥ 1); reading it as v${toVersion}.`
  );
  return toVersion;
}

/** E2 + migrations: true when the root now has the game's format version. */
export function upgradeFormatVersion(
  root: Element,
  log: LevelIssueLog,
  options: MigrationOptions = {}
): boolean {
  const raw = root.getAttribute("data-level-format") ?? "";
  const toVersion = options.toVersion ?? LEVEL_FORMAT_VERSION;
  const version = readFormatVersion(raw, toVersion, log);
  if (version > toVersion) {
    addError(
      log,
      "E2",
      `This level is format v${version}, made for a newer version of the game (this game reads up to v${toVersion}).`
    );
    return false;
  }
  const migrated = migrateLevelRoot(root, version, { ...options, toVersion });
  if (migrated.ok) return true;
  addError(
    log,
    "E2",
    `Format v${version} can't be upgraded: no migration from v${migrated.missingStep}. Rewrite the level for format v${toVersion} (LEVEL_FORMAT.md).`
  );
  return false;
}

type WorldSize = { w: number; h: number };

const positiveSize = (w: number | null, h: number | null): WorldSize | null =>
  w !== null && h !== null && w > 0 && h > 0 ? { w, h } : null;

const numberAttr = (el: Element | null, attr: string): number | null => {
  const raw = el ? el.getAttribute(attr) : null;
  return raw === null ? null : parsePlainNumber(raw);
};

/** A `viewBox` of 4 plain numbers, as its far corner: `x y W H` → world `x+W` × `y+H`. */
function viewBoxCorner(raw: string): { size: WorldSize; atOrigin: boolean } | null {
  const parts = raw
    .trim()
    .split(/[\s,]+/)
    .map(parsePlainNumber);
  if (parts.length !== 4 || parts.some((part) => part === null)) return null;
  const [x = 0, y = 0, w = 0, h = 0] = parts as number[];
  const size = Math.min(x, y) >= 0 ? positiveSize(w, h) : null;
  return size && { size: { w: x + w, h: y + h }, atOrigin: x === 0 && y === 0 };
}

/** W17 fallbacks when the viewBox is unusable: the root's width/height, else the bounds' far corner. */
function fallbackWorldSize(root: Element): { size: WorldSize; source: string } | null {
  const attrs = positiveSize(numberAttr(root, "width"), numberAttr(root, "height"));
  if (attrs) return { size: attrs, source: "the root's width and height" };
  const bounds = root.querySelector('rect[data-role="bounds"]');
  const corner = positiveSize(
    (numberAttr(bounds, "x") ?? 0) + (numberAttr(bounds, "width") ?? NaN),
    (numberAttr(bounds, "y") ?? 0) + (numberAttr(bounds, "height") ?? NaN)
  );
  return corner && { size: corner, source: "the bounds rect" };
}

/**
 * The world size. `viewBox="0 0 W H"` is the rule; an offset viewBox, the root's width/height or
 * the bounds rect stand in with W17. E3 only when none of them gives a size.
 */
export function readWorldSize(root: Element, log: LevelIssueLog): WorldSize | null {
  const raw = root.getAttribute("viewBox") ?? "";
  const viewBox = viewBoxCorner(raw);
  if (viewBox?.atOrigin) return viewBox.size;
  const problem =
    raw === "" ? "The root <svg> has no viewBox" : `viewBox "${raw}" is not "0 0 <width> <height>"`;
  const fallback = viewBox
    ? { size: viewBox.size, source: "its far corner" }
    : fallbackWorldSize(root);
  if (fallback) {
    const { w, h } = fallback.size;
    addWarning(log, "W17", `${problem}; using ${fallback.source}: world 0 0 ${w} ${h}.`);
    return fallback.size;
  }
  addError(
    log,
    "E3",
    `${problem}, and no width/height or bounds rect gives the size; add viewBox="0 0 <width> <height>".`
  );
  return null;
}

/** `data-level-id`, else a slug of the title. */
const slugOf = (title: string): string => {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  if (slug === "") return "untitled-level";
  return /^[a-z]/.test(slug) ? slug : `level-${slug}`.slice(0, 64);
};

function readLevelId(root: Element, title: string, log: LevelIssueLog): string {
  const raw = root.getAttribute("data-level-id");
  if (raw === null) return slugOf(title);
  if (CATALOG_ID_RE.test(raw)) return raw;
  const slug = slugOf(title);
  addWarning(
    log,
    "W4",
    `data-level-id "${raw}" is not a valid ID (lowercase kebab-case); using "${slug}".`
  );
  return slug;
}

const optionalText = (root: Element, attr: string): string | undefined => {
  const value = root.getAttribute(attr)?.trim();
  return value ? value : undefined;
};

/** Metadata (W9: missing title). */
export function readLevelMeta(root: Element, log: LevelIssueLog): LevelMeta {
  let title = optionalText(root, "data-title");
  if (title === undefined) {
    addWarning(log, "W9", `data-title is missing on the root <svg>; using "${UNTITLED_LEVEL}".`);
    title = UNTITLED_LEVEL;
  }
  const author = optionalText(root, "data-author");
  const agent = optionalText(root, "data-agent");
  const description = optionalText(root, "data-description");
  return {
    levelId: readLevelId(root, title, log),
    title,
    ...(author !== undefined && { author }),
    ...(agent !== undefined && { agent }),
    ...(description !== undefined && { description }),
  };
}

interface SettingSpec {
  attr: string;
  integer: boolean;
  rule: string;
  fallback: string;
  valid: (value: number) => boolean;
}

const SETTING_SPECS = {
  cellSize: {
    attr: "data-cell-size",
    integer: true,
    rule: "a whole number ≥ 1",
    fallback: String(DEFAULT_LEVEL_SETTINGS.cellSize),
    valid: (v: number) => v >= 1,
  },
  gravity: {
    attr: "data-gravity",
    integer: false,
    rule: "a number above 0",
    fallback: String(DEFAULT_LEVEL_SETTINGS.gravity),
    valid: (v: number) => v > 0,
  },
  matchDurationS: {
    attr: "data-match-duration",
    integer: true,
    rule: "whole seconds above 0",
    fallback: `the match setting (${DEFAULT_GAME_TUNABLES.match.durationSeconds} s)`,
    valid: (v: number) => v > 0,
  },
} satisfies Record<Exclude<keyof LevelSettings, "weaponIds">, SettingSpec>;

const NO_WEAPONS = "none";
const AUTO_WEAPONS = "auto";

/**
 * `data-weapons`: space-separated weapon IDs, or `none` (level-direction D6). Left out or `auto`
 * = the lobby's choice. W4: a non-weapon ID is left out; when none is left, the lobby's choice.
 */
export function readWeaponsSetting(root: Element, log: LevelIssueLog): string[] | undefined {
  const raw = root.getAttribute("data-weapons")?.trim();
  if (raw === undefined || raw === "" || raw === AUTO_WEAPONS) return undefined;
  if (raw === NO_WEAPONS) return [];
  const ids = raw.split(/\s+/);
  const weapons = ids.filter((id) => isWeaponItemId(id));
  for (const id of ids) {
    if (!isWeaponItemId(id))
      addWarning(log, "W4", `data-weapons: "${id}" is not a weapon; left out.`);
  }
  if (weapons.length > 0) return weapons;
  addWarning(log, "W4", "data-weapons names no weapon; using the lobby's weapons.");
  return undefined;
}

/** W8: a setting out of range falls back to its default. */
function readSetting(root: Element, spec: SettingSpec, log: LevelIssueLog): number | undefined {
  const raw = root.getAttribute(spec.attr);
  if (raw === null) return undefined;
  const value = parsePlainNumber(raw);
  if (value !== null && (!spec.integer || Number.isInteger(value)) && spec.valid(value)) {
    return value;
  }
  addWarning(log, "W8", `${spec.attr}="${raw}" must be ${spec.rule}; using ${spec.fallback}.`);
  return undefined;
}

export function readLevelSettings(root: Element, log: LevelIssueLog): LevelSettings {
  const cellSize = readSetting(root, SETTING_SPECS.cellSize, log);
  const gravity = readSetting(root, SETTING_SPECS.gravity, log);
  const matchDurationS = readSetting(root, SETTING_SPECS.matchDurationS, log);
  const weaponIds = readWeaponsSetting(root, log);
  return {
    cellSize: cellSize ?? DEFAULT_LEVEL_SETTINGS.cellSize,
    gravity: gravity ?? DEFAULT_LEVEL_SETTINGS.gravity,
    ...(matchDurationS !== undefined && { matchDurationS }),
    ...(weaponIds !== undefined && { weaponIds }),
  };
}
