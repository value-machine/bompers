import type { Rect, Shape2D, Vec2 } from "@/shared/types/gameGeometry.types";
import { addError, type LevelIssueLog } from "@/features/level-file/services/levelFileIssues";
import type { RoleElement } from "@/features/level-file/types/levelFile.types";

/**
 * Reads geometry attributes of role elements (LEVEL_FORMAT § 4–5). 1 SVG unit = 1 world unit,
 * so plain numbers only: a unit, a non-number or a missing required attribute is E8. `x`, `y`,
 * `cx`, `cy` default to 0 like in SVG; sizes are required and must be positive.
 */
const NUMBER = String.raw`[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?`;
const NUMBER_RE = new RegExp(`^${NUMBER}$`);
const NUMBER_WITH_UNIT_RE = new RegExp(`^${NUMBER}\\s*(?:[a-zA-Z]+|%)$`);
const MIN_POLYGON_POINTS = 3;

/** Parses a plain number (no unit); null when the text is anything else. */
export const parsePlainNumber = (text: string): number | null =>
  NUMBER_RE.test(text.trim()) ? Number(text.trim()) : null;

const describeBadNumber = (attr: string, raw: string): string =>
  NUMBER_WITH_UNIT_RE.test(raw.trim())
    ? `${attr} "${raw}" uses a unit; write plain numbers (world units)`
    : `${attr} "${raw}" is not a number`;

interface NumberSpec {
  attr: string;
  /** Size attribute: required and > 0. Position attributes default to 0. */
  size?: boolean;
}

function readNumber(item: RoleElement, spec: NumberSpec, log: LevelIssueLog): number | null {
  const raw = item.el.getAttribute(spec.attr);
  if (raw === null) {
    if (!spec.size) return 0;
    addError(log, "E8", `${item.name}: ${spec.attr} is missing.`);
    return null;
  }
  const value = parsePlainNumber(raw);
  if (value === null) {
    addError(log, "E8", `${item.name}: ${describeBadNumber(spec.attr, raw)}.`);
    return null;
  }
  if (spec.size && value <= 0) {
    addError(log, "E8", `${item.name}: ${spec.attr} must be above 0 (got ${raw}).`);
    return null;
  }
  return value;
}

/** Reads several attributes; null when any of them failed (each failure is logged). */
function readNumbers(
  item: RoleElement,
  specs: readonly NumberSpec[],
  log: LevelIssueLog
): number[] | null {
  const values = specs.map((spec) => readNumber(item, spec, log));
  return values.every((v): v is number => v !== null) ? values : null;
}

export function readRect(item: RoleElement, log: LevelIssueLog): Rect | null {
  const values = readNumbers(
    item,
    [{ attr: "x" }, { attr: "y" }, { attr: "width", size: true }, { attr: "height", size: true }],
    log
  );
  if (!values) return null;
  const [x = 0, y = 0, w = 0, h = 0] = values;
  return { x, y, w, h };
}

function readPolygonPoints(item: RoleElement, log: LevelIssueLog): Vec2[] | null {
  const raw = item.el.getAttribute("points");
  if (raw === null) {
    addError(log, "E8", `${item.name}: points is missing.`);
    return null;
  }
  const tokens = raw.split(/[\s,]+/).filter((t) => t !== "");
  const bad = tokens.find((t) => parsePlainNumber(t) === null);
  if (bad !== undefined) {
    addError(log, "E8", `${item.name}: points has ${describeBadNumber("value", bad)}.`);
    return null;
  }
  if (tokens.length % 2 !== 0 || tokens.length < MIN_POLYGON_POINTS * 2) {
    addError(log, "E8", `${item.name}: points needs at least 3 "x,y" pairs.`);
    return null;
  }
  return tokens
    .filter((_, i) => i % 2 === 0)
    .map((x, i) => ({ x: Number(x), y: Number(tokens[i * 2 + 1]) }));
}

/** The terrain shape of a rect / polygon / circle role element. */
export function readShape(item: RoleElement, log: LevelIssueLog): Shape2D | null {
  const tag = item.el.localName;
  if (tag === "rect") {
    const rect = readRect(item, log);
    return rect && { type: "rect", ...rect };
  }
  if (tag === "polygon") {
    const points = readPolygonPoints(item, log);
    return points && { type: "polygon", points };
  }
  const values = readNumbers(
    item,
    [{ attr: "cx" }, { attr: "cy" }, { attr: "r", size: true }],
    log
  );
  if (!values) return null;
  const [cx = 0, cy = 0, r = 0] = values;
  return { type: "circle", cx, cy, r };
}

/** A point role's position: the circle centre (`r` is visual only). */
export function readPoint(item: RoleElement, log: LevelIssueLog): Vec2 | null {
  const values = readNumbers(item, [{ attr: "cx" }, { attr: "cy" }], log);
  if (!values) return null;
  const [x = 0, y = 0] = values;
  return { x, y };
}

export const rectContainsPoint = (rect: Rect, p: Vec2): boolean =>
  p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h;

export const rectContainsRect = (outer: Rect, inner: Rect): boolean =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.w <= outer.x + outer.w &&
  inner.y + inner.h <= outer.y + outer.h;
