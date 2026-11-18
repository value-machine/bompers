import { describe, expect, it } from "vitest";
import { GAME_PALETTE, weaponLook } from "@/shared/config/gamePalette";
import {
  weaponTubeBounds,
  weaponTubeMark,
  weaponTubeParts,
  type WeaponTubeShape,
} from "@/shared/utils/weaponTube";

const looks = Object.values(GAME_PALETTE.weaponLooks);

describe("weaponLook", () => {
  it("should give the rocket launcher the lip mouth and the sky accent when looked up", () => {
    expect(weaponLook("rocket-launcher")).toEqual({ accent: 0x8fd6ff, tube: "lip" });
  });

  it("should give the homing launcher the finned mouth and the lilac accent when looked up", () => {
    expect(weaponLook("homing-launcher")).toEqual({ accent: 0xb08cff, tube: "finned" });
  });

  it("should give the torch the funnel mouth and the ember accent when looked up", () => {
    expect(weaponLook("torch")).toEqual({ accent: 0xff8a1f, tube: "funnel" });
  });

  it("should never use a player body colour as a weapon accent when any weapon is looked up", () => {
    for (const look of looks) {
      expect(GAME_PALETTE.players).not.toContain(look.accent);
    }
  });
});

describe("weaponTubeParts", () => {
  // Ground truth: the owner's picks (weapon-visuals-embellish D1, D3, D6, D7).
  it("should give every weapon exactly one barrel that starts at the helmet centre when built", () => {
    for (const { tube } of looks) {
      const barrels = weaponTubeParts(tube, 1).parts.filter((part) => part.role === "barrel");
      expect(barrels).toHaveLength(1);
      expect(weaponTubeBounds(barrels).left).toBe(0);
    }
  });

  it("should taper the barrel from the helmet to the mouth when built", () => {
    for (const { tube } of looks) {
      const [barrel] = weaponTubeParts(tube, 1).parts;
      if (barrel?.kind !== "poly") throw new Error("the barrel is a polygon");
      const [, rootY, , tipY] = barrel.points;
      expect(Math.abs(rootY ?? 0)).toBeGreaterThan(Math.abs(tipY ?? 0));
    }
  });

  it("should give every weapon a mouth beyond the barrel when built", () => {
    for (const { tube } of looks) {
      const { parts } = weaponTubeParts(tube, 1);
      const mouth = parts.filter((part) => part.role === "mouth");
      expect(mouth.length).toBeGreaterThan(0);
      const barrel = parts.filter((part) => part.role === "barrel");
      expect(weaponTubeBounds(mouth).right).toBeGreaterThan(weaponTubeBounds(barrel).right);
    }
  });

  it("should give each weapon its own mouth when the shapes are compared", () => {
    const mouths = (["lip", "finned", "funnel"] satisfies WeaponTubeShape[]).map((shape) =>
      JSON.stringify(weaponTubeParts(shape, 1).parts.filter((part) => part.role === "mouth"))
    );
    expect(new Set(mouths).size).toBe(3);
  });

  it("should sweep the homing fins back toward the helmet when shape is finned", () => {
    const fins = weaponTubeParts("finned", 1).parts.filter(
      (part) => part.role === "mouth" && part.kind === "poly"
    );
    expect(fins).toHaveLength(2);
    for (const fin of fins) {
      if (fin.kind !== "poly") continue;
      // The outer edge (furthest from the axis) lies behind the fin's root at the lip.
      const xs = fin.points.filter((_, i) => i % 2 === 0);
      const ys = fin.points.filter((_, i) => i % 2 === 1).map(Math.abs);
      const outerX = xs[ys.indexOf(Math.max(...ys))] ?? 0;
      expect(outerX).toBeLessThan(Math.max(...xs));
    }
  });

  it("should scale every part with u when built at two sizes", () => {
    const one = weaponTubeBounds(weaponTubeParts("finned", 1).parts);
    const two = weaponTubeBounds(weaponTubeParts("finned", 2).parts);
    expect(two).toEqual({
      left: one.left * 2,
      right: one.right * 2,
      top: one.top * 2,
      bottom: one.bottom * 2,
    });
  });
});

describe("weaponTubeMark", () => {
  it("should show only the mouth end of the barrel when built for a crate", () => {
    for (const { tube } of looks) {
      const mark = weaponTubeBounds(weaponTubeMark(tube, 1).parts);
      expect(mark.left).toBeGreaterThan(0);
      expect(mark.right).toBe(weaponTubeBounds(weaponTubeParts(tube, 1).parts).right);
    }
  });

  it("should report the centre of its own bounds when built, so the crate can centre it", () => {
    for (const { tube } of looks) {
      const mark = weaponTubeMark(tube, 2);
      const { left, right, top, bottom } = weaponTubeBounds(mark.parts);
      expect(mark.centre.x).toBeCloseTo((left + right) / 2);
      expect(mark.centre.y).toBeCloseTo((top + bottom) / 2);
      expect(mark.centre.y).toBeCloseTo(0);
    }
  });
});
