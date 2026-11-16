import { describe, expect, it } from "vitest";
import { GAME_PALETTE, weaponLook } from "@/shared/config/gamePalette";
import { weaponTubeParts } from "@/shared/utils/weaponTube";

describe("weaponLook", () => {
  it("should give the rocket launcher the capped tube and the sky accent when looked up", () => {
    expect(weaponLook("rocket-launcher")).toEqual({ accent: 0x8fd6ff, tube: "capped" });
  });

  it("should return the fallback look when the item has no entry", () => {
    expect(weaponLook("toString")).toBe(GAME_PALETTE.fallbackWeaponLook);
  });
});

describe("weaponTubeParts", () => {
  it("should scale the capped tube with u when built at two sizes", () => {
    const one = weaponTubeParts("capped", 1);
    const two = weaponTubeParts("capped", 2);
    expect(two.parts.map((p) => p.width)).toEqual(one.parts.map((p) => p.width * 2));
    expect(two.muzzle.x).toBe(one.muzzle.x * 2);
  });

  it("should keep the rocket tube geometry of the blob renderer when shape is capped", () => {
    // Ground truth: blobShapes.tubePath (tube 26 × 14 from x −3, cap 8 × 16 from x 17).
    const { parts, muzzle } = weaponTubeParts("capped", 1);
    expect(parts).toEqual([
      { x: -3, y: -7, width: 26, height: 14, radius: 6 },
      { x: 17, y: -8, width: 8, height: 16, radius: 3.5 },
    ]);
    expect(muzzle).toEqual({ x: 21, y: 0 });
  });
});
