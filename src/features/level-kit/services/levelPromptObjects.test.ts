import { describe, expect, it } from "vitest";
import { exportObjectCatalog } from "@/features/level-objects/api/levelObjectsApi";
import { buildLevelPrompt } from "@/features/level-kit/services/levelPrompt";
import { objectRoleRow, renderObjects } from "@/features/level-kit/services/levelPromptObjects";

describe("levelPromptObjects", () => {
  it("should list every kind and variant from the registry when the objects section is built", () => {
    const text = renderObjects(4);
    for (const recipe of exportObjectCatalog()) {
      expect(text).toContain(`\`${recipe.kind}\``);
      expect(text).toContain(`height \`${recipe.height.min}\`–\`${recipe.height.max}\``);
      for (const variant of recipe.variants) {
        expect(text).toContain(
          `\`${variant.id}\` (${variant.label}): width ${variant.aspect.min}–${variant.aspect.max}`
        );
      }
    }
  });

  it("should put the object row and section into the level prompt when the prompt is built", () => {
    const prompt = buildLevelPrompt();
    expect(prompt).toContain(objectRoleRow());
    expect(prompt).toContain("### Objects (optional)");
    expect(prompt).toContain('data-role="object" data-kind="tree"');
  });

  it("should show an example rect of each object class when the objects section is built", () => {
    const text = renderObjects(4);
    expect(text).toContain(
      'data-role="object" data-kind="ball" data-variant="beach" x="1000" y="560" width="48" height="48"'
    );
    expect(text).toContain(
      'data-role="object" data-kind="kart" data-variant="go-kart" x="1080" y="576" width="64" height="32"'
    );
    expect(text).toContain("**Physics objects**");
    expect(text).toContain("**Karts**");
  });
});
