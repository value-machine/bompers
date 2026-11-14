import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LEVEL_FILE_MIGRATIONS } from "@/features/level-file/services/levelFileMigrations";
import {
  parseLevelFile,
  type LevelImportResult,
} from "@/features/level-file/services/levelFileParser";
import type { LevelIssue } from "@/features/level-file/types/levelFile.types";

// Ground truth: the kit files shipped with the format spec (documentation/game/LEVEL_FORMAT.md).
const readRepoFile = (rel: string): string => readFileSync(path.join(process.cwd(), rel), "utf8");
const EXAMPLE = readRepoFile("public/level-kit/v1/example-level.html");
const BUILT_INS = ["start-arena", "floating-garden"].map((id) => ({
  id,
  text: readRepoFile(`public/levels/${id}.html`),
}));
const AUTHORING_EXAMPLES = [
  ...readRepoFile("public/level-kit/v1/AUTHORING.md").matchAll(/```html\n([\s\S]*?)```/g),
]
  .map((m) => m[1]!)
  .filter((block) => block.includes("data-level-format"));

/** A valid level whose root attributes and body can be swapped per test. */
const level = (body: string, rootAttrs = 'data-level-format="1" data-title="T"'): string => `
<!doctype html><html><body>
<svg id="level" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" ${rootAttrs}>
  ${body}
</svg></body></html>`;

const BOUNDS = '<rect data-role="bounds" x="0" y="0" width="800" height="600" />';
const GROUND = '<rect id="ground" data-role="platform" x="100" y="400" width="600" height="64" />';
const SPAWNS = [200, 300, 500, 600]
  .map((x) => `<circle data-role="spawn" cx="${x}" cy="376" r="14" />`)
  .join("");
const DROP = '<circle data-role="drop" cx="400" cy="40" r="12" />';
const VALID_BODY = BOUNDS + GROUND + SPAWNS + DROP;

const codes = (issues: readonly LevelIssue[]): (string | undefined)[] => issues.map((i) => i.code);
const okLevel = (result: LevelImportResult) => {
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result.errors)}`);
  return result;
};
const errorsOf = (result: LevelImportResult): LevelIssue[] => (result.ok ? [] : result.errors);

describe("parseLevelFile — kit files", () => {
  it("should import the kit example with every role and no warnings when the file is the shipped example", () => {
    const { level: def, warnings } = okLevel(parseLevelFile(EXAMPLE));
    expect(warnings).toEqual([]);
    expect(def.meta).toEqual({
      levelId: "floating-garden",
      title: "Floating Garden",
      author: "Bompers team",
      agent: "claude",
      description: expect.stringContaining("floating main platform") as string,
    });
    expect(def.settings).toEqual({ cellSize: 8, gravity: 1, matchDurationS: 180 });
    expect(def.worldSize).toEqual({ w: 1600, h: 1000 });
    expect(def.bounds).toEqual({ x: 40, y: 20, w: 1520, h: 960 });
    expect(def.terrain).toHaveLength(8);
    expect(def.spawns).toEqual([
      { x: 480, y: 616 },
      { x: 1120, y: 616 },
      { x: 560, y: 436 },
      { x: 1040, y: 436 },
    ]);
    expect(def.drops).toEqual([
      { at: { x: 600, y: 80 }, itemIds: ["rocket-launcher"] },
      { at: { x: 1000, y: 80 }, itemIds: ["rocket-launcher"] },
    ]);
    expect(def.collectibles).toHaveLength(3);
  });

  it("should read rect, polygon and circle terrain with their references when the example is parsed", () => {
    const { level: def } = okLevel(parseLevelFile(EXAMPLE));
    expect(def.terrain).toContainEqual({
      shape: {
        type: "polygon",
        points: [
          { x: 480, y: 704 },
          { x: 1120, y: 704 },
          { x: 1040, y: 800 },
          { x: 560, y: 800 },
        ],
      },
      role: "platform",
      materialId: "stone",
    });
    expect(def.terrain).toContainEqual({
      shape: { type: "circle", cx: 800, cy: 300, r: 28 },
      role: "destructible",
      materialId: "dirt",
      effectId: "dust-burst",
      soundId: "crumble",
    });
  });

  it("should put destructible pieces before platforms when shapes overlap so platforms win", () => {
    const roles = okLevel(parseLevelFile(EXAMPLE)).level.terrain.map((p) => p.role);
    const firstPlatform = roles.indexOf("platform");
    expect(roles.slice(firstPlatform).every((r) => r === "platform")).toBe(true);
  });

  it("should import every built-in level without warnings when shipped in public/levels", () => {
    for (const { id, text } of BUILT_INS) {
      const result = okLevel(parseLevelFile(text));
      expect(result.warnings).toEqual([]);
      expect(result.level.meta.levelId).toBe(id);
    }
  });

  it("should give the default start arena 4 spawns, 5 drops and 5 collectibles when imported", () => {
    const { level: def } = okLevel(parseLevelFile(BUILT_INS[0]!.text));
    expect(def.spawns).toHaveLength(4);
    expect(def.drops).toHaveLength(5);
    expect(def.collectibles).toHaveLength(5);
  });

  it("should import both AUTHORING.md examples without errors", () => {
    expect(AUTHORING_EXAMPLES).toHaveLength(2);
    for (const text of AUTHORING_EXAMPLES) {
      expect(okLevel(parseLevelFile(text)).warnings).toEqual([]);
    }
  });

  it("should accept a bare SVG file when the root is the same", () => {
    const svg = `<?xml version="1.0"?>${level(VALID_BODY).replace(/<\/?(html|body)>|<!doctype html>/g, "")}`;
    expect(parseLevelFile(svg).ok).toBe(true);
  });
});

describe("parseLevelFile — errors reject the file", () => {
  const cases: [string, string, string][] = [
    ["E1", "<html><body><svg viewBox='0 0 10 10'></svg></body></html>", "No level found"],
    ["E1", level(VALID_BODY) + level(VALID_BODY), "Found 2"],
    ["E2", level(VALID_BODY, 'data-level-format="one" data-title="T"'), "not a format version"],
    ["E2", level(VALID_BODY, 'data-level-format="2" data-title="T"'), "newer version of the game"],
    [
      "E3",
      level(VALID_BODY).replace('viewBox="0 0 800 600"', 'viewBox="10 0 800 600"'),
      'must be "0 0 <width> <height>"',
    ],
    ["E4", level(GROUND + SPAWNS + DROP), "No bounds"],
    ["E4", level(BOUNDS + BOUNDS + GROUND + SPAWNS + DROP), "Found 2 bounds"],
    [
      "E4",
      level(VALID_BODY.replace('width="800" height="600"', 'width="900" height="600"')),
      "outside the viewBox",
    ],
    [
      "E5",
      level(BOUNDS + GROUND + DROP + '<circle data-role="spawn" cx="200" cy="300" r="1"/>'),
      "Only 1 valid spawn",
    ],
    ["E6", level(BOUNDS + SPAWNS + DROP), "No valid terrain"],
    ["E7", level(BOUNDS + GROUND + SPAWNS), "No valid drop point"],
    [
      "E8",
      level(VALID_BODY.replace('width="600"', 'width="600px"')),
      'platform "ground": width "600px" uses a unit',
    ],
    ["E8", level(VALID_BODY.replace('height="64"', "")), 'platform "ground": height is missing'],
    ["E8", level(VALID_BODY.replace('cx="400"', 'cx="mid"')), 'drop #1: cx "mid" is not a number'],
    [
      "E8",
      level(BOUNDS + SPAWNS + DROP + '<polygon data-role="platform" points="0,0 10,10" />'),
      "at least 3",
    ],
  ];

  it.each(cases)("should report %s when the file breaks that rule (%#)", (code, text, message) => {
    const result = parseLevelFile(text);
    expect(result.ok).toBe(false);
    const match = errorsOf(result).find((e) => e.code === code);
    expect(match?.message).toContain(message);
  });

  it("should never throw when the text is not a level at all", () => {
    expect(parseLevelFile("").ok).toBe(false);
    expect(parseLevelFile('{ "json": true }').ok).toBe(false);
  });
});

const warn = (body: string, rootAttrs?: string) => okLevel(parseLevelFile(level(body, rootAttrs)));

describe("parseLevelFile — element warnings load with fallbacks", () => {
  it("should load a valid level without warnings", () => {
    expect(warn(VALID_BODY).warnings).toEqual([]);
  });

  it("should ignore an unknown data-role with W1", () => {
    const result = warn(VALID_BODY + '<rect data-role="lava" x="0" y="0" width="8" height="8" />');
    expect(result.warnings).toEqual([
      { code: "W1", message: '<rect> #1 has unknown data-role "lava"; ignored.' },
    ]);
  });

  it("should skip a role on the wrong element with W2", () => {
    const result = warn(
      VALID_BODY + '<rect id="sq" data-role="spawn" x="0" y="0" width="8" height="8" />'
    );
    expect(result.warnings).toEqual([
      { code: "W2", message: 'spawn "sq" is a <rect>; spawn must be <circle>. Ignored.' },
    ]);
    expect(result.level.spawns).toHaveLength(4);
  });

  it("should skip an element under a transformed group with W3", () => {
    const result = warn(
      VALID_BODY +
        '<g transform="translate(5 0)"><rect data-role="platform" x="0" y="0" width="8" height="8" /></g>'
    );
    expect(codes(result.warnings)).toEqual(["W3"]);
    expect(result.level.terrain).toHaveLength(1);
  });

  it("should fall back to the role default with W4 when a reference is unknown or malformed", () => {
    const result = warn(
      BOUNDS +
        SPAWNS +
        '<rect id="a" data-role="destructible" data-material="lava" data-sound="Boom" x="100" y="400" width="600" height="64" />' +
        '<circle data-role="drop" data-items="laser" cx="400" cy="40" r="1" />' +
        '<circle data-role="collectible" data-item="gem" cx="400" cy="80" r="1" />'
    );
    expect(result.warnings).toEqual([
      { code: "W4", message: 'destructible "a": unknown material "lava"; using "dirt".' },
      {
        code: "W4",
        message:
          'destructible "a": data-sound="Boom" is not a valid ID (lowercase kebab-case); using the material\'s.',
      },
      { code: "W4", message: 'drop #1: unknown item "laser"; left out.' },
      { code: "W4", message: 'drop #1: no known item in data-items; using "rocket-launcher".' },
      { code: "W4", message: 'collectible #1: unknown item "gem"; using "point-orb".' },
    ]);
    expect(result.level.terrain[0]).toMatchObject({ materialId: "dirt" });
    expect(result.level.terrain[0]).not.toHaveProperty("soundId");
    expect(result.level.drops[0]?.itemIds).toEqual(["rocket-launcher"]);
    expect(result.level.collectibles[0]?.itemId).toBe("point-orb");
  });
});

describe("parseLevelFile — placement, ids and settings warnings", () => {
  it("should ignore points outside bounds or spawns inside terrain with W5", () => {
    const result = warn(
      VALID_BODY.replace('width="800" height="600" />', 'width="800" height="500" />') +
        '<circle data-role="drop" cx="400" cy="550" r="1" />' +
        '<circle data-role="spawn" cx="400" cy="420" r="1" />'
    );
    expect(result.warnings).toEqual([
      { code: "W5", message: "spawn #5 is inside solid terrain; ignored." },
      { code: "W5", message: "drop #2 lies outside bounds; ignored." },
    ]);
    expect(result.level.drops).toHaveLength(1);
  });

  it("should warn W6 when fewer than 4 spawns remain", () => {
    const body = BOUNDS + GROUND + DROP + SPAWNS.split("/>").slice(0, 3).join("/>") + "/>";
    expect(codes(warn(body).warnings)).toEqual(["W6"]);
  });

  it("should drop the later duplicate id with W7", () => {
    const result = warn(VALID_BODY + GROUND.replace('x="100"', 'x="120"'));
    expect(result.warnings).toEqual([
      {
        code: "W7",
        message: 'Duplicate id "ground" on platform #2; the later element loses its id.',
      },
    ]);
  });

  it("should use defaults with W8 when settings are out of range", () => {
    const result = warn(
      VALID_BODY,
      'data-level-format="1" data-title="T" data-cell-size="0" data-gravity="-1" data-match-duration="2.5"'
    );
    expect(codes(result.warnings)).toEqual(["W8", "W8", "W8"]);
    expect(result.level.settings).toEqual({ cellSize: 8, gravity: 1 });
  });

  it("should title the level Untitled with W9 when data-title is missing", () => {
    const result = warn(VALID_BODY, 'data-level-format="1"');
    expect(codes(result.warnings)).toEqual(["W9"]);
    expect(result.level.meta).toMatchObject({ title: "Untitled level", levelId: "untitled-level" });
  });

  it("should ignore unknown data attributes with W10 when a role element has them", () => {
    const result = warn(
      VALID_BODY.replace('id="ground"', 'id="ground" data-wobble="3" data-effect="none"')
    );
    expect(result.warnings).toEqual([
      { code: "W10", message: 'platform "ground": data-wobble is not used on platform; ignored.' },
      { code: "W10", message: 'platform "ground": data-effect is not used on platform; ignored.' },
    ]);
  });

  it("should ignore presentation when elements have no data-role", () => {
    const decorated =
      VALID_BODY +
      '<path d="M0 0L10 10"/><text>hi</text><rect fill="red" x="0" y="0" width="1" height="1"/>';
    expect(warn(decorated).warnings).toEqual([]);
  });
});

describe("parseLevelFile — format migrations", () => {
  it("should keep the registry empty while format 1 is the only version", () => {
    expect(LEVEL_FILE_MIGRATIONS).toEqual({});
  });

  it("should run each step up to the game's version when an older file is imported", () => {
    // A pretend v2 game that renamed `data-role="platform"` to `"solid"`; v1 files migrate.
    const renameInV2 = (root: Element): void =>
      root
        .querySelectorAll('[data-role="platform"]')
        .forEach((el) => el.setAttribute("data-role", "ground-v2"));
    const backToV1Names = (root: Element): void =>
      root
        .querySelectorAll('[data-role="ground-v2"]')
        .forEach((el) => el.setAttribute("data-role", "platform"));
    const result = parseLevelFile(level(VALID_BODY), {
      toVersion: 3,
      migrations: { 1: renameInV2, 2: backToV1Names },
    });
    expect(okLevel(result).level.formatVersion).toBe(3);
    expect(result.ok && result.level.terrain).toHaveLength(1);
  });

  it("should reject with E2 when a migration step is missing", () => {
    const result = parseLevelFile(level(VALID_BODY), { toVersion: 2, migrations: {} });
    expect(errorsOf(result)).toEqual([
      { code: "E2", message: "Format v1 can't be upgraded: no migration from v1." },
    ]);
  });
});
