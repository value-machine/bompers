import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Shape2D } from "@/shared/types/gameGeometry.types";
import {
  buildTerrainFromLevel,
  clearCrater,
  getCellInfo,
  groundFrictionBelow,
} from "@/features/arena/api/arenaApi";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import { LEVEL_FILE_MIGRATIONS } from "@/features/level-file/services/levelFileMigrations";
import { spawnLift } from "@/features/level-file/services/levelFileGeometry";
import { formatLevelImportReport } from "@/features/level-file/services/levelFileIssues";
import {
  parseLevelFile,
  type LevelImportResult,
} from "@/features/level-file/services/levelFileParser";
import type { LevelIssue } from "@/features/level-file/types/levelFile.types";

// Ground truth: the kit files shipped with the format spec (documentation/game/LEVEL_FORMAT.md).
const readRepoFile = (rel: string): string => readFileSync(path.join(process.cwd(), rel), "utf8");
const EXAMPLE = readRepoFile("public/level-kit/v2/example-level.html");
const FIRE_TEST = readRepoFile("public/level-kit/v2/fire-test-level.html");
const CRUSHER_TEST = readRepoFile("public/level-kit/v2/crusher-test-level.html");
const FORGIVING_TEST = readRepoFile("public/level-kit/v2/forgiving-test-level.html");
const ORBIT_TEST = readRepoFile("public/level-kit/v2/orbit-test-level.html");
const BUILT_INS = [
  "start-arena",
  "floating-garden",
  "bobsled-run",
  "piston-works",
  "bonfire-bridge",
  "crystal-gap",
  "slush-bowl",
  "tree-grove",
  "beach-court",
  "ball-playground",
].map((id) => ({
  id,
  text: readRepoFile(`public/levels/${id}.html`),
}));
const AUTHORING_EXAMPLES = [
  ...readRepoFile("public/level-kit/v2/AUTHORING.md").matchAll(/```html\n([\s\S]*?)```/g),
]
  .map((m) => m[1]!)
  .filter((block) => block.includes("data-level-format"));

/** A valid level whose root attributes and body can be swapped per test. */
const level = (body: string, rootAttrs = 'data-level-format="2" data-title="T"'): string => `
<!doctype html><html><body>
<svg id="level" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" ${rootAttrs}>
  ${body}
</svg></body></html>`;

const BOUNDS = '<rect data-role="bounds" x="0" y="0" width="800" height="600" />';
const GROUND = '<rect id="ground" data-role="terrain" x="100" y="400" width="600" height="64" />';
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
    expect(def.movers).toEqual([
      {
        motion: { kind: "slide", offset: { x: 0, y: -240 }, periodS: 6, phase: 0 },
        pivot: { x: 232, y: 652 },
        terrainIndices: [8],
      },
    ]);
    expect(def.meta).toEqual({
      levelId: "floating-garden",
      title: "Floating Garden",
      author: "Bompers team",
      agent: "claude",
      description: expect.stringContaining("floating main platform") as string,
    });
    expect(def.settings).toEqual({ cellSize: 4, gravity: 1, matchDurationS: 180 });
    expect(def.worldSize).toEqual({ w: 1600, h: 1000 });
    expect(def.bounds).toEqual({ x: 40, y: 20, w: 1520, h: 960 });
    expect(def.terrain).toHaveLength(9);
    expect(def.spawns).toEqual([
      { x: 480, y: 616 },
      { x: 1120, y: 616 },
      { x: 560, y: 436 },
      { x: 1040, y: 436 },
    ]);
    expect(def.drops).toEqual([{ at: { x: 600, y: 80 } }, { at: { x: 1000, y: 80 } }]);
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
      materialId: "stone",
      colorId: "plum",
    });
    expect(def.terrain).toContainEqual({
      shape: { type: "circle", cx: 800, cy: 300, r: 28 },
      materialId: "earth",
      colorId: "rose",
      effectId: "dust-burst",
      soundId: "crumble",
    });
  });

  it("should import every built-in level without warnings when shipped in public/levels", () => {
    for (const { id, text } of BUILT_INS) {
      const result = okLevel(parseLevelFile(text));
      expect(result.warnings).toEqual([]);
      expect(result.level.meta.levelId).toBe(id);
    }
  });

  it("should give the default start arena 4 spawns, 5 drops, 5 point orbs and 3 headbutt resets when imported", () => {
    const { level: def } = okLevel(parseLevelFile(BUILT_INS[0]!.text));
    expect(def.spawns).toHaveLength(4);
    expect(def.drops).toHaveLength(5);
    const items = def.collectibles.map((point) => point.itemId);
    expect(items.filter((id) => id === "point-orb")).toHaveLength(5);
    expect(items.filter((id) => id === "dive-reset")).toHaveLength(3);
  });

  it("should give Ball Playground 4 health pickups when imported", () => {
    const playground = BUILT_INS.find((built) => built.id === "ball-playground")!;
    const { level: def } = okLevel(parseLevelFile(playground.text));
    const items = def.collectibles.map((point) => point.itemId);
    expect(items.filter((id) => id === "health")).toHaveLength(4);
  });

  it("should give the fire test level cardboard to burn, four spawns and only torches when imported", () => {
    const { level: def, warnings } = okLevel(parseLevelFile(FIRE_TEST));
    expect(warnings).toEqual([]);
    expect(def.meta.levelId).toBe("fire-test");
    expect(def.spawns).toHaveLength(4);
    expect(def.drops).toHaveLength(3);
    expect(def.settings.weaponIds).toEqual(["torch", "rocket-launcher"]);
    // Ten static pieces and two moving parts (a lift and a spinner) that burn away.
    expect(def.terrain.filter((piece) => piece.materialId === "cardboard")).toHaveLength(12);
    expect(def.movers).toHaveLength(2);
    // Spawns stand on the big slabs, not inside them.
    const grid = buildTerrainFromLevel(def);
    const cellAt = (x: number, y: number) =>
      getCellInfo(grid, Math.floor(x / grid.cellSize), Math.floor(y / grid.cellSize));
    for (const spawn of def.spawns) {
      expect(cellAt(spawn.x, spawn.y)).toBeNull();
      expect(cellAt(spawn.x, spawn.y + 28)?.materialId).toBe("cardboard");
    }
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
    ["E2", level(VALID_BODY, 'data-level-format="3" data-title="T"'), "newer version of the game"],
    [
      "E2",
      level(VALID_BODY, 'data-level-format="2.5" data-title="T"'),
      "newer version of the game",
    ],
    [
      "E3",
      level(GROUND + SPAWNS + DROP).replace('viewBox="0 0 800 600"', 'viewBox="wide"'),
      "no width/height or bounds rect gives the size",
    ],
    ["E5", level(BOUNDS.replace('y="0"', 'y="390"') + GROUND + DROP), "no room above the terrain"],
    ["E6", level(BOUNDS + SPAWNS + DROP), "No valid terrain"],
    [
      "E6",
      level(BOUNDS + SPAWNS + DROP + '<polygon data-role="terrain" points="0,0 10,10" />'),
      "No valid terrain",
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

describe("parseLevelFile — forgiving import (survivable rules load with fallbacks)", () => {
  /** The owner's odd file: no viewBox, no bounds, one spawn, no drop, one shape with a unit. */
  const ODD_FILE = `<svg data-level-format="2" data-title="Odd" width="800" height="600">
    ${GROUND}
    <rect id="bad" data-role="terrain" x="10" y="10" width="10px" height="10" />
    <circle data-role="spawn" cx="400" cy="376" r="14" />
  </svg>`;

  it("should load the odd file with a warning per survivable rule", () => {
    const result = okLevel(parseLevelFile(ODD_FILE));
    expect(codes(result.warnings)).toEqual(["W17", "W21", "W18", "W6", "W20"]);
    expect(result.level.worldSize).toEqual({ w: 800, h: 600 });
    expect(result.level.bounds).toEqual({ x: 0, y: 0, w: 800, h: 600 });
    expect(result.level.terrain).toHaveLength(1);
    expect(result.level.spawns).toHaveLength(1);
    expect(result.level.drops).toEqual([]);
  });

  it("should load the kit's forgiving test level with exactly the warnings its comment lists", () => {
    const result = okLevel(parseLevelFile(FORGIVING_TEST));
    expect(codes(result.warnings)).toEqual(["W16", "W17", "W21", "W21", "W18", "W6", "W20"]);
    expect(result.level.terrain).toHaveLength(3);
    expect(result.level.collectibles).toHaveLength(2);
  });

  it("should use the first root with W15 when the file holds two", () => {
    const result = okLevel(parseLevelFile(level(VALID_BODY) + level(VALID_BODY)));
    expect(codes(result.warnings)).toEqual(["W15"]);
  });

  it("should read a version that is not a whole number as the game's with W16", () => {
    const result = warn(VALID_BODY, 'data-level-format="two" data-title="T"');
    expect(result.warnings[0]?.message).toContain("reading it as v2");
  });

  it("should take the far corner of an offset viewBox with W17", () => {
    const text = level(VALID_BODY).replace('viewBox="0 0 800 600"', 'viewBox="10 0 790 600"');
    const result = okLevel(parseLevelFile(text));
    expect(codes(result.warnings)).toEqual(["W17"]);
    expect(result.level.worldSize).toEqual({ w: 800, h: 600 });
  });

  it("should size the world from the bounds rect with W17 when nothing else gives it", () => {
    const text = level(VALID_BODY).replace('viewBox="0 0 800 600"', "");
    expect(okLevel(parseLevelFile(text)).level.worldSize).toEqual({ w: 800, h: 600 });
  });

  it("should use the first bounds or clip it to the world with W18", () => {
    expect(codes(warn(VALID_BODY + BOUNDS).warnings)).toEqual(["W18"]);
    const wide = warn(VALID_BODY.replace('width="800" height="600"', 'width="900" height="600"'));
    expect(wide.warnings[0]?.message).toContain("outside the viewBox");
    expect(wide.level.bounds).toEqual({ x: 0, y: 0, w: 800, h: 600 });
  });

  it("should place spawns above the widest terrain with W19 when the file names none", () => {
    const result = warn(BOUNDS + GROUND + DROP);
    expect(codes(result.warnings)).toEqual(["W19"]);
    expect(result.level.spawns).toEqual([{ x: 400, y: 400 - spawnLift(DEFAULT_GAME_TUNABLES) }]);
  });

  it("should load without crates with W20 when there is no drop point", () => {
    const result = warn(BOUNDS + GROUND + SPAWNS);
    expect(codes(result.warnings)).toEqual(["W20"]);
    expect(result.level.drops).toEqual([]);
  });

  it.each([
    [VALID_BODY.replace('width="600"', 'width="600px"'), 'width "600px" uses a unit'],
    [VALID_BODY.replace('cx="400"', 'cx="mid"'), 'drop #1: cx "mid" is not a number'],
  ])("should skip an element with broken geometry with W21 (%#)", (body, message) => {
    const result = parseLevelFile(level(body + GROUND.replace('id="ground" ', "")));
    const w21 = result.warnings.find((w) => w.code === "W21");
    expect(w21?.message).toContain(message);
    expect(w21?.message).toContain("ignored");
  });
});

describe("formatLevelImportReport", () => {
  it("should list each warning with its code when the odd file loaded", () => {
    const result = okLevel(parseLevelFile(level(BOUNDS + GROUND + SPAWNS)));
    const text = formatLevelImportReport({
      fileName: "odd.html",
      ok: true,
      errors: [],
      warnings: [...result.warnings, { message: "engine note" }],
    });
    expect(text).toBe(
      [
        "Bompers level import report (rules: LEVEL_FORMAT.md § 7, format v2)",
        "File: odd.html",
        "Loaded with 2 warning(s).",
        "",
        "Warnings:",
        `- W20 ${result.warnings[0]?.message}`,
        "- engine note",
        "",
      ].join("\n")
    );
  });

  it("should list the errors first when the file was rejected", () => {
    const result = parseLevelFile(level(BOUNDS + SPAWNS + DROP));
    const text = formatLevelImportReport({
      fileName: "empty.html",
      ok: result.ok,
      errors: result.ok ? [] : result.errors,
      warnings: result.warnings,
    });
    expect(text).toContain("Rejected: 1 error(s), the game can't run it.\n\nErrors:\n- E6 ");
  });
});

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
        '<g transform="translate(5 0)"><rect data-role="terrain" x="0" y="0" width="8" height="8" /></g>'
    );
    expect(codes(result.warnings)).toEqual(["W3"]);
    expect(result.level.terrain).toHaveLength(1);
  });

  it("should fall back to the default with W4 when a reference is unknown or malformed", () => {
    const result = warn(
      BOUNDS +
        SPAWNS +
        '<rect id="a" data-role="terrain" data-material="lava" data-color="teal" data-sound="Boom" x="100" y="400" width="600" height="64" />' +
        '<circle data-role="drop" cx="400" cy="40" r="1" />' +
        '<circle data-role="collectible" data-item="gem" cx="400" cy="80" r="1" />'
    );
    expect(result.warnings).toEqual([
      { code: "W4", message: 'terrain "a": unknown material "lava"; using "stone".' },
      { code: "W4", message: 'terrain "a": unknown color "teal"; using the material\'s.' },
      {
        code: "W4",
        message:
          'terrain "a": data-sound="Boom" is not a valid ID (lowercase kebab-case); using the material\'s.',
      },
      { code: "W4", message: 'collectible #1: unknown item "gem"; using "point-orb".' },
    ]);
    expect(result.level.terrain[0]).toMatchObject({ materialId: "stone", colorId: "plum" });
    expect(result.level.terrain[0]).not.toHaveProperty("soundId");
    expect(result.level.collectibles[0]?.itemId).toBe("point-orb");
  });

  it("should fall back to the role default with W11 when a weapon sits on a collectible", () => {
    const result = warn(
      VALID_BODY +
        '<circle id="c" data-role="collectible" data-item="rocket-launcher" cx="400" cy="80" r="1" />'
    );
    expect(result.warnings).toEqual([
      {
        code: "W11",
        message:
          'collectible "c": "rocket-launcher" is a drop item, not a collectible item; using "point-orb".',
      },
    ]);
    expect(result.level.collectibles.map((c) => c.itemId)).toEqual(["point-orb"]);
  });

  it("should warn W10 when a drop still lists data-items", () => {
    const result = warn(
      VALID_BODY + '<circle data-role="drop" data-items="torch" cx="300" cy="40" r="1" />'
    );
    expect(codes(result.warnings)).toEqual(["W10"]);
  });
});

describe("parseLevelFile — weapons setting", () => {
  const weaponsOf = (attr: string) =>
    warn(VALID_BODY, `data-level-format="2" data-title="T" ${attr}`);

  it("should leave the weapons to the lobby when data-weapons is missing or auto", () => {
    expect(weaponsOf("").level.settings).not.toHaveProperty("weaponIds");
    expect(weaponsOf('data-weapons="auto"').level.settings).not.toHaveProperty("weaponIds");
  });

  it("should read the listed weapons when data-weapons names some", () => {
    const result = weaponsOf('data-weapons="rocket-launcher  freeze-ray"');
    expect(result.warnings).toEqual([]);
    expect(result.level.settings.weaponIds).toEqual(["rocket-launcher", "freeze-ray"]);
  });

  it("should read no weapons when data-weapons is none", () => {
    expect(weaponsOf('data-weapons="none"').level.settings.weaponIds).toEqual([]);
  });

  it("should leave out non-weapons with W4 and fall back to the lobby when none is left", () => {
    const some = weaponsOf('data-weapons="torch point-orb"');
    expect(some.level.settings.weaponIds).toEqual(["torch"]);
    expect(some.warnings).toEqual([
      { code: "W4", message: 'data-weapons: "point-orb" is not a weapon; left out.' },
    ]);
    const none = weaponsOf('data-weapons="laser"');
    expect(none.level.settings).not.toHaveProperty("weaponIds");
    expect(codes(none.warnings)).toEqual(["W4", "W4"]);
  });
});

describe("parseLevelFile — theme setting", () => {
  const themeOf = (attr: string) =>
    warn(VALID_BODY, `data-level-format="2" data-title="T" ${attr}`);

  it("should leave the theme unset when data-theme is missing", () => {
    const result = themeOf("");
    expect(result.warnings).toEqual([]);
    expect(result.level.settings).not.toHaveProperty("themeId");
  });

  it("should read a known theme when data-theme names one", () => {
    const result = themeOf('data-theme=" night-sky "');
    expect(result.warnings).toEqual([]);
    expect(result.level.settings.themeId).toBe("night-sky");
  });

  it("should fall back to the default theme with W24 when data-theme is unknown", () => {
    const result = themeOf('data-theme="lava"');
    expect(result.level.settings).not.toHaveProperty("themeId");
    expect(result.warnings).toEqual([
      { code: "W24", message: 'data-theme "lava" is not a theme; using "meadow".' },
    ]);
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
        message: 'Duplicate id "ground" on terrain #2; the later element loses its id.',
      },
    ]);
  });

  it("should use defaults with W8 when settings are out of range", () => {
    const result = warn(
      VALID_BODY,
      'data-level-format="2" data-title="T" data-cell-size="0" data-gravity="-1" data-match-duration="2.5"'
    );
    expect(codes(result.warnings)).toEqual(["W8", "W8", "W8"]);
    expect(result.level.settings).toEqual({ cellSize: 4, gravity: 1 });
  });

  it("should title the level Untitled with W9 when data-title is missing", () => {
    const result = warn(VALID_BODY, 'data-level-format="2"');
    expect(codes(result.warnings)).toEqual(["W9"]);
    expect(result.level.meta).toMatchObject({ title: "Untitled level", levelId: "untitled-level" });
  });

  it("should ignore unknown data attributes with W10 when a role element has them", () => {
    const result = warn(
      VALID_BODY.replace('id="ground"', 'id="ground" data-wobble="3" data-color="mint"')
    );
    expect(result.warnings).toEqual([
      { code: "W10", message: 'terrain "ground": data-wobble is not used on terrain; ignored.' },
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
  it("should keep the registry empty when format 2 shipped without a v1 migration", () => {
    expect(LEVEL_FILE_MIGRATIONS).toEqual({});
  });

  it("should run each step up to the game's version when an older file is imported", () => {
    // A pretend v3 game that renamed `data-role="terrain"`; v2 files migrate there and back.
    const renameInV3 = (root: Element): void =>
      root
        .querySelectorAll('[data-role="terrain"]')
        .forEach((el) => el.setAttribute("data-role", "ground-v3"));
    const backToV2Names = (root: Element): void =>
      root
        .querySelectorAll('[data-role="ground-v3"]')
        .forEach((el) => el.setAttribute("data-role", "terrain"));
    const result = parseLevelFile(level(VALID_BODY), {
      toVersion: 4,
      migrations: { 2: renameInV3, 3: backToV2Names },
    });
    expect(okLevel(result).level.formatVersion).toBe(4);
    expect(result.ok && result.level.terrain).toHaveLength(1);
  });

  it("should reject with E2 when a migration step is missing", () => {
    const result = parseLevelFile(level(VALID_BODY, 'data-level-format="1" data-title="T"'));
    expect(errorsOf(result)).toEqual([
      {
        code: "E2",
        message:
          "Format v1 can't be upgraded: no migration from v1. Rewrite the level for format v2 (LEVEL_FORMAT.md).",
      },
    ]);
  });
});

// Acceptance test of the material-system lap (BRIEF success check): material sets behaviour,
// colour is looks only. Ground truth: the catalog in code (stone / earth / cardboard / ice).
const MATERIALS = ["stone", "earth", "cardboard", "ice"] as const;
const COLORS = ["rose", "moss"] as const;
const BREAKABLE = new Set(["earth", "cardboard"]);

/** One 64 × 64 block per material × colour along a row at y 400, 96 units apart. */
const blocks = MATERIALS.flatMap((material, m) =>
  COLORS.map((color, c) => ({ material, color, x: 64 + (m * COLORS.length + c) * 96 }))
);

const file = `<!doctype html><html><body>
<svg id="level" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 600" data-level-format="2" data-title="Materials">
  <rect data-role="bounds" x="0" y="0" width="1000" height="600" />
  ${blocks
    .map(
      (b) =>
        `<rect data-role="terrain" data-material="${b.material}" data-color="${b.color}" x="${b.x}" y="400" width="64" height="64" />`
    )
    .join("")}
  ${[100, 300, 500, 700].map((x) => `<circle data-role="spawn" cx="${x}" cy="376" r="14" />`).join("")}
  <circle data-role="drop" cx="500" cy="40" r="12" />
</svg></body></html>`;

describe("material system (acceptance)", () => {
  it("should import every material in two colours without warnings when the file uses format 2", () => {
    const result = parseLevelFile(file);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.warnings).toEqual([]);
    expect(result.level.terrain.map((p) => [p.materialId, p.colorId])).toEqual(
      blocks.map((b) => [b.material, b.color])
    );
  });

  it("should clear only breakable materials whatever their colour when each block is blasted", () => {
    const result = parseLevelFile(file);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    const grid = buildTerrainFromLevel(result.level);
    for (const b of blocks) {
      const cleared = clearCrater(grid, { x: b.x + 32, y: 432, reach: 20, shape: "round" });
      expect(cleared.removed > 0, `${b.material}/${b.color}`).toBe(BREAKABLE.has(b.material));
      const cx = Math.floor((b.x + 2) / grid.cellSize);
      const top = Math.floor(402 / grid.cellSize);
      expect(getCellInfo(grid, cx, top)).toMatchObject({
        materialId: b.material,
        colorId: b.color,
      });
    }
  });

  it("should give ice the only low grip under the feet when blobs stand on each block", () => {
    const result = parseLevelFile(file);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    const grid = buildTerrainFromLevel(result.level);
    for (const b of blocks) {
      const grip = groundFrictionBelow(grid, { x: b.x + 16, y: 400, w: 32 });
      if (b.material === "ice") expect(grip).toBeLessThan(0.5);
      else expect(grip).toBe(1);
    }
  });
});

describe("parseLevelFile — moving-parts test level", () => {
  it("should import the crusher test level with its four moving parts and no warnings", () => {
    const { level: def, warnings } = okLevel(parseLevelFile(CRUSHER_TEST));
    expect(warnings).toEqual([]);
    expect(def.meta.levelId).toBe("crusher-test");
    expect(def.spawns).toHaveLength(4);
    expect(def.movers?.map((mover) => mover.motion.kind)).toEqual([
      "slide",
      "spin",
      "slide",
      "slide",
    ]);
    expect(def.movers?.[0]?.sounds).toEqual({ end: "thud" });
  });
});

describe("parseLevelFile — level objects", () => {
  const TREE_GROVE = BUILT_INS.find((b) => b.id === "tree-grove")!.text;
  const tree = (attrs: string): string =>
    `<rect data-role="object" data-kind="tree" ${attrs} x="380" y="192" width="104" height="208" />`;
  const withTree = (attrs: string): string => level(VALID_BODY + tree(attrs));

  it("should build every tree variant into terrain without warnings when the tree grove is imported", () => {
    const { level: def, warnings } = okLevel(parseLevelFile(TREE_GROVE));
    expect(warnings).toEqual([]);
    const variants = new Set(def.objects?.map((o) => o.variant));
    for (const id of ["oak", "pine", "snowy-pine", "palm", "dead"]) expect(variants).toContain(id);
    for (const object of def.objects ?? []) {
      expect(object.terrainIndices.length).toBeGreaterThan(2);
      const pieces = object.terrainIndices.map((i) => def.terrain[i]!);
      expect(pieces.every((p) => p.materialId && p.colorId)).toBe(true);
    }
  });

  it("should import a ball as a physics object with no terrain pieces when the level places one", () => {
    const ball =
      '<rect data-role="object" data-kind="ball" data-variant="beach" x="380" y="352" width="48" height="48" />';
    const { level: def, warnings } = okLevel(parseLevelFile(level(VALID_BODY + ball)));
    expect(warnings).toEqual([]);
    expect(def.objects).toEqual([
      expect.objectContaining({ kind: "ball", variant: "beach", terrainIndices: [] }),
    ]);
    expect(def.objects![0]!.box).toMatchObject({ w: 48, h: 48 });
  });

  it("should put an object inside a moving group into that part without W13 when it rides a platform", () => {
    const { level: def, warnings } = okLevel(parseLevelFile(TREE_GROVE));
    expect(codes(warnings)).not.toContain("W13");
    const riding = def.objects!.find((o) => o.box.y === 192)!;
    const mover = def.movers![0]!;
    for (const i of riding.terrainIndices) expect(mover.terrainIndices).toContain(i);
  });

  it("should add the tree's pieces after the ground in document order when a tree follows the ground", () => {
    const { level: def, warnings } = okLevel(parseLevelFile(withTree('data-variant="pine"')));
    expect(warnings).toEqual([]);
    const object = def.objects![0]!;
    expect(object).toMatchObject({ kind: "tree", variant: "pine" });
    expect(object.terrainIndices[0]).toBe(1);
    expect(def.terrain).toHaveLength(1 + object.terrainIndices.length);
    expect(def.terrain.slice(1).some((p) => p.materialId === "cardboard")).toBe(true);
  });

  it("should build the same tree each import and differ by element when no seed is given", () => {
    const one = okLevel(parseLevelFile(withTree('data-variant="oak"'))).level.objects![0]!;
    const again = okLevel(parseLevelFile(withTree('data-variant="oak"'))).level.objects![0]!;
    const named = okLevel(parseLevelFile(withTree('id="t" data-variant="oak"'))).level.objects![0]!;
    expect(again.seed).toBe(one.seed);
    expect(named.seed).not.toBe(one.seed);
  });

  it("should skip the element with W22 when the kind is unknown or missing", () => {
    const unknown = okLevel(
      parseLevelFile(
        level(
          VALID_BODY +
            '<rect data-role="object" data-kind="rock" x="380" y="300" width="100" height="100" />'
        )
      )
    );
    expect(codes(unknown.warnings)).toEqual(["W22"]);
    expect(unknown.level.objects).toBeUndefined();
    expect(unknown.level.terrain).toHaveLength(1);
    const missing = okLevel(
      parseLevelFile(
        level(VALID_BODY + '<rect data-role="object" x="380" y="300" width="100" height="100" />')
      )
    );
    expect(codes(missing.warnings)).toEqual(["W22"]);
  });

  it("should warn W23 and clamp when the variant is unknown, the box too tall or the seed not a number", () => {
    // The fallback oak is wider than this pine-shaped box, so the width is clamped too.
    const variant = okLevel(parseLevelFile(withTree('data-variant="birch"')));
    expect(codes(variant.warnings)).toEqual(["W23", "W23"]);
    expect(variant.warnings[0]!.message).toContain('unknown tree variant "birch"');
    expect(variant.level.objects![0]!.variant).toBe("oak");
    const tall = okLevel(
      parseLevelFile(
        level(
          VALID_BODY +
            '<rect data-role="object" data-kind="tree" data-variant="pine" x="380" y="-600" width="300" height="1000" />'
        )
      )
    );
    expect(codes(tall.warnings)).toEqual(["W23"]);
    expect(tall.level.objects![0]!.box).toMatchObject({ h: 480, y: -80, w: 300 });
    const seed = okLevel(parseLevelFile(withTree('data-variant="pine" data-seed="abc"')));
    expect(codes(seed.warnings)).toEqual(["W23"]);
  });

  it("should skip a spawn inside a tree with W5 when the spawn sits in its trunk", () => {
    const body =
      VALID_BODY +
      tree('data-variant="pine"') +
      '<circle data-role="spawn" cx="432" cy="380" r="14" />';
    const result = okLevel(parseLevelFile(level(body)));
    expect(codes(result.warnings)).toEqual(["W5"]);
    expect(result.level.spawns).toHaveLength(4);
  });
});

// Ground truth: the owner's planet repro (level-orbit lap): trees on a spinning planet, upright.
describe("parseLevelFile — turned objects on a spinning planet (level-orbit)", () => {
  const PLANET = { x: 400, y: 320, r: 160 };
  const planet = (trees: string): string =>
    level(`<rect data-role="bounds" x="0" y="0" width="800" height="600" />
      <g data-motion="spin 20s center">
        <circle data-role="terrain" cx="${PLANET.x}" cy="${PLANET.y}" r="${PLANET.r}" />
        ${trees}
      </g>
      ${[300, 380, 420, 500].map((x) => `<circle data-role="spawn" cx="${x}" cy="20" r="14" />`).join("")}
      <circle data-role="drop" cx="400" cy="40" r="12" />`);
  /** An upright pine standing on the planet top, turned `deg` about the planet centre. */
  const treeOnTop = (deg: number): string =>
    `<rect data-role="object" data-kind="tree" data-variant="pine" x="376" y="64" width="48" height="96" transform="rotate(${deg} ${PLANET.x} ${PLANET.y})" />`;
  const xsOf = (def: { terrain: readonly { shape: Shape2D }[] }, indices: readonly number[]) =>
    indices.flatMap((i) => {
      const shape = def.terrain[i]!.shape;
      if (shape.type === "circle") return [shape.cx];
      return shape.type === "polygon" ? shape.points.map((p) => p.x) : [];
    });

  it("should import the orbit test level with no warnings, spinning about the planet, its trees turned as written", () => {
    const { level: def, warnings } = okLevel(parseLevelFile(ORBIT_TEST));
    expect(warnings).toEqual([]);
    expect(def.movers?.[0]?.pivot).toEqual({ x: 900, y: 680 });
    expect(def.objects?.map((o) => o.rotation?.degrees)).toEqual(
      [0, -50, 50, -110, 110].map((d) => (d === 0 ? undefined : d))
    );
  });

  it("should build an object upright when its rect has no transform", () => {
    const upright = treeOnTop(0).replace(/ transform="[^"]*"/, "");
    const { level: def, warnings } = okLevel(parseLevelFile(planet(upright)));
    expect(warnings).toEqual([]);
    expect(def.objects![0]!.rotation).toBeUndefined();
  });

  it("should turn an object's parts about the rotate point when the rect carries rotate(a cx cy)", () => {
    const { level: def, warnings } = okLevel(parseLevelFile(planet(treeOnTop(90))));
    expect(warnings).toEqual([]);
    const object = def.objects![0]!;
    expect(object.rotation).toEqual({ degrees: 90, about: { x: 400, y: 320 } });
    // A quarter turn clockwise: the tree stands on the planet's right side, pointing right.
    expect(Math.min(...xsOf(def, object.terrainIndices))).toBeGreaterThan(PLANET.x + PLANET.r - 12);
  });

  it("should spin about the planet's own centre when trees stand on one side of it", () => {
    const { level: def } = okLevel(parseLevelFile(planet(treeOnTop(0))));
    expect(def.movers?.[0]?.pivot).toEqual({ x: 400, y: 320 });
  });

  it("should still warn W3 when an object has another transform or sits in a transformed group", () => {
    const scaled = treeOnTop(0).replace(/transform="[^"]*"/, 'transform="scale(2)"');
    expect(codes(okLevel(parseLevelFile(planet(scaled))).warnings)).toContain("W3");
    const grouped = `<g transform="translate(0 0)">${treeOnTop(0)}</g>`;
    expect(codes(okLevel(parseLevelFile(planet(grouped))).warnings)).toContain("W3");
  });
});
