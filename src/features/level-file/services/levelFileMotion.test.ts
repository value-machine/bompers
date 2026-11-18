import { describe, expect, it } from "vitest";
import { motionPose } from "@/shared/utils/levelMotion";
import { parseMotionSpec } from "@/features/level-file/services/levelFileMotion";
import {
  parseLevelFile,
  type LevelImportResult,
} from "@/features/level-file/services/levelFileParser";
import type { LevelIssue } from "@/features/level-file/types/levelFile.types";

// Ground truth: LEVEL_FORMAT § 11 (moving parts) and the lap ledger moving-parts D1–D9.
const level = (body: string): string => `
<!doctype html><html><body>
<svg id="level" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" data-level-format="2" data-title="T">
  <rect data-role="bounds" x="0" y="0" width="800" height="600" />
  <rect id="ground" data-role="terrain" x="100" y="400" width="600" height="64" />
  ${[200, 300, 500, 600].map((x) => `<circle data-role="spawn" cx="${x}" cy="376" r="14" />`).join("")}
  <circle data-role="drop" cx="400" cy="40" r="12" />
  ${body}
</svg></body></html>`;

const LIFT = '<rect id="lift" data-role="terrain" x="320" y="320" width="160" height="32" />';

const okLevel = (result: LevelImportResult) => {
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result.errors)}`);
  return result;
};
const coded = (warnings: readonly LevelIssue[], code: string): string[] =>
  warnings.filter((w) => w.code === code).map((w) => w.message);

describe("moving parts — import", () => {
  it("should import a slide mover with its rest-pose pieces when a group has data-motion", () => {
    const { level: def, warnings } = okLevel(
      parseLevelFile(level(`<g data-motion="slide 0,-160">${LIFT}</g>`))
    );
    expect(def.movers).toEqual([
      {
        motion: { kind: "slide", offset: { x: 0, y: -160 }, periodS: 4, phase: 0 },
        pivot: { x: 400, y: 336 },
        terrainIndices: [1],
      },
    ]);
    expect(def.terrain).toHaveLength(2);
    expect(warnings).toEqual([]);
    expect(motionPose(def.movers![0]!.motion, 2)).toMatchObject({ dx: 0, dy: -160 });
  });

  it("should keep the group still with W12 when data-motion does not parse", () => {
    const { level: def, warnings } = okLevel(
      parseLevelFile(
        level(`<g id="lift" data-motion="hover 0,-160">${LIFT.replace('id="lift" ', "")}</g>`)
      )
    );
    expect(def.movers).toBeUndefined();
    expect(coded(warnings, "W12")[0]).toMatch(/moving part "lift".*"hover" is not a motion/);
  });

  it("should warn W14 when the sweep runs into static terrain", () => {
    const { warnings } = okLevel(parseLevelFile(level(`<g data-motion="slide 0,80">${LIFT}</g>`)));
    expect(coded(warnings, "W14").join(" ")).toMatch(/runs into static terrain/);
  });

  it("should warn W14 when a part sweeps over a spawn or leaves the bounds", () => {
    const { warnings } = okLevel(
      parseLevelFile(
        level(
          `<g data-motion="slide -200,0"><rect data-role="terrain" x="320" y="352" width="160" height="16" /></g><g data-motion="slide 0,-400">${LIFT.replace("lift", "lift2")}</g>`
        )
      )
    );
    const w14 = coded(warnings, "W14").join(" ");
    expect(w14).toMatch(/sweeps over a spawn/);
    expect(w14).toMatch(/leaves the bounds/);
  });

  it("should warn W13 when a spawn or a nested motion sits inside a moving group", () => {
    const { level: def, warnings } = okLevel(
      parseLevelFile(
        level(
          `<g data-motion="spin 8s"><g data-motion="slide 8,0">${LIFT}</g><circle data-role="collectible" cx="400" cy="300" r="10" /></g>`
        )
      )
    );
    expect(def.movers).toHaveLength(1);
    expect(def.movers![0]!.motion).toMatchObject({ kind: "spin", direction: 1, periodS: 8 });
    expect(coded(warnings, "W13")).toHaveLength(2);
  });

  it("should warn W14 when the part moves faster than a player can ride", () => {
    const { warnings } = okLevel(
      parseLevelFile(level(`<g data-motion="path 0,-200 1s">${LIFT}</g>`))
    );
    expect(coded(warnings, "W14").join(" ")).toMatch(/faster than a player can ride/);
  });

  it("should read the author's part sounds and leave out an unknown one with W4", () => {
    const { level: def, warnings } = okLevel(
      parseLevelFile(
        level(
          `<g data-motion="slide 0,-160" data-move-sound="jump" data-end-sound="whoosh">${LIFT}</g>`
        )
      )
    );
    expect(def.movers?.[0]?.sounds).toEqual({ move: "jump" });
    expect(coded(warnings, "W4").join(" ")).toMatch(/data-end-sound="whoosh" is not a known sound/);
  });
});

describe("parseMotionSpec", () => {
  it("should apply the kind defaults when only the kind and its argument are given", () => {
    expect(parseMotionSpec("swing 30", 4)).toEqual({
      ok: true,
      motion: { kind: "swing", degrees: 30, direction: 1, periodS: 4, phase: 0 },
      pivot: "top",
      notes: [],
    });
    expect(parseMotionSpec("spin ccw 6s @0.25 bottom-left", 4)).toMatchObject({
      ok: true,
      motion: { kind: "spin", direction: -1, periodS: 6, phase: 0.25 },
      pivot: "bottom-left",
    });
  });

  it("should note a clamped period and an off-grid offset when values are out of line", () => {
    const parsed = parseMotionSpec("path 10,0 0,-8 0.2s", 4);
    expect(parsed.ok && parsed.motion.periodS).toBe(1);
    expect(parsed.ok && parsed.notes.join(" ")).toMatch(/outside 1–30s.*off the 4-unit grid/);
  });

  it("should reject arguments that do not fit the kind", () => {
    expect(parseMotionSpec("slide", 4)).toMatchObject({ ok: false });
    expect(parseMotionSpec("spin 0,8", 4)).toMatchObject({ ok: false });
    expect(parseMotionSpec("swing 200", 4)).toMatchObject({ ok: false });
    expect(parseMotionSpec("slide 0,8 wobble", 4)).toMatchObject({ ok: false });
  });
});
