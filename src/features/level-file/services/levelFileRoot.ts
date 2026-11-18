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

/** E1: exactly one root. */
export function findLevelRoot(doc: Document, log: LevelIssueLog): Element | null {
  const roots = doc.querySelectorAll(ROOT_SELECTOR);
  if (roots.length === 1) return roots[0] ?? null;
  addError(
    log,
    "E1",
    roots.length === 0
      ? "No level found: the file needs one <svg> with a data-level-format attribute."
      : `Found ${roots.length} <svg data-level-format> elements; a level file holds exactly one.`
  );
  return null;
}

/** E2 + migrations: true when the root now has the game's format version. */
export function upgradeFormatVersion(
  root: Element,
  log: LevelIssueLog,
  options: MigrationOptions = {}
): boolean {
  const raw = root.getAttribute("data-level-format") ?? "";
  const toVersion = options.toVersion ?? LEVEL_FORMAT_VERSION;
  const version = /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : NaN;
  if (!Number.isInteger(version) || version < 1) {
    addError(log, "E2", `data-level-format="${raw}" is not a format version (a whole number ≥ 1).`);
    return false;
  }
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

/** E3: `viewBox="0 0 W H"`, W and H > 0. */
export function readWorldSize(root: Element, log: LevelIssueLog): { w: number; h: number } | null {
  const raw = root.getAttribute("viewBox") ?? "";
  const parts = raw
    .trim()
    .split(/[\s,]+/)
    .map(parsePlainNumber);
  const [x, y, w, h] = parts;
  if (parts.length === 4 && x === 0 && y === 0 && w && h && w > 0 && h > 0) return { w, h };
  addError(
    log,
    "E3",
    raw === ""
      ? 'The root <svg> has no viewBox; add viewBox="0 0 <width> <height>".'
      : `viewBox "${raw}" must be "0 0 <width> <height>" with width and height above 0.`
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
