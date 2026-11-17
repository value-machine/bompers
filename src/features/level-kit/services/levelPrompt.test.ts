import { describe, expect, it } from "vitest";
import {
  CATALOG_DEFAULTS,
  LEVEL_FORMAT_VERSION,
  exportCatalog,
} from "@/features/content-catalog/api/contentCatalogApi";
import { parseLevelFile } from "@/features/level-file/api/levelFileApi";
import { buildLevelPrompt } from "@/features/level-kit/services/levelPrompt";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";

const htmlBlocks = (text: string): string[] =>
  [...text.matchAll(/```html\n([\s\S]*?)```/g)].map((m) => m[1] ?? "");

describe("buildLevelPrompt", () => {
  const prompt = buildLevelPrompt();

  it("should have the seven sections of the owner's example when built", () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7]) expect(prompt).toMatch(new RegExp(`^## ${n}\\. `, "m"));
    const lines = prompt.trimEnd().split("\n");
    expect(lines[lines.length - 1]).toMatch(/^Describe your map here/);
  });

  it("should state the live format version and level defaults when built", () => {
    expect(prompt).toContain(`data-level-format="${LEVEL_FORMAT_VERSION}"`);
    expect(prompt).toContain(`data-match-duration="${CATALOG_DEFAULTS.matchDuration}"`);
    expect(prompt).toContain(`data-cell-size="${CATALOG_DEFAULTS.cellSize}"`);
  });

  it("should list every material, colour and item ID from the catalog when built", () => {
    const catalog = exportCatalog();
    for (const entry of [...catalog.material, ...catalog.color, ...catalog.item]) {
      expect(prompt).toContain(`\`${entry.id}\``);
    }
  });

  it("should derive the physics from the tunables when gravity changes", () => {
    const g = DEFAULT_GAME_TUNABLES.world.gravity;
    const apex = Math.round(DEFAULT_GAME_TUNABLES.player.jumpSpeed ** 2 / (2 * g));
    expect(prompt).toContain(`Gravity \`${g}\``);
    expect(prompt).toContain(`apex ~\`${apex}\``);

    const floaty = buildLevelPrompt({
      ...DEFAULT_GAME_TUNABLES,
      world: { ...DEFAULT_GAME_TUNABLES.world, gravity: g / 2 },
    });
    expect(floaty).toContain(`Gravity \`${g / 2}\``);
    expect(floaty).toContain(`apex ~\`${apex * 2}\``);
  });

  it("should state each weapon's blast power and the crater per toughness when built", () => {
    const { rocket, homing } = DEFAULT_GAME_TUNABLES.combat;
    expect(prompt).toContain(`blast power \`${rocket.power}\``);
    expect(prompt).toContain(`blast power \`${homing.power}\``);
    expect(prompt).toMatch(/`cardboard`: breakable, toughness 0\.7 \(a rocket clears ~49 units/);
  });

  it("should embed a reference level that imports with no errors or warnings", () => {
    const [level] = htmlBlocks(prompt).filter((block) => block.includes('data-role="bounds"'));
    const result = parseLevelFile(level ?? "");
    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it("should teach moving parts with an example that imports with no motion warnings", () => {
    const [snippet] = [...prompt.matchAll(/```svg\n([\s\S]*?)```/g)].map((m) => m[1] ?? "");
    expect(prompt).toContain("### Moving parts");
    const file = `<svg viewBox="0 0 1600 1000" data-level-format="${LEVEL_FORMAT_VERSION}" data-title="M">
      <rect data-role="bounds" x="0" y="0" width="1600" height="1000" />
      <rect data-role="terrain" x="0" y="900" width="1600" height="64" />
      ${[100, 200, 300, 400].map((x) => `<circle data-role="spawn" cx="${x}" cy="876" r="14" />`).join("")}
      <circle data-role="drop" cx="200" cy="80" r="12" />
      ${snippet ?? ""}</svg>`;
    const result = parseLevelFile(file);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.level.movers).toHaveLength(2);
    expect(result.warnings.filter((w) => w.code !== undefined)).toEqual([]);
  });
});
