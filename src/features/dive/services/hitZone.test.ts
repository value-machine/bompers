import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import { classifyHitZone, hitDamage } from "@/features/dive/services/hitZone";

const D = DEFAULT_GAME_TUNABLES.dive;
const zone = (direction: { x: number; y: number }, facing: -1 | 1) =>
  classifyHitZone(facing, direction);

describe("classifyHitZone", () => {
  it("should be a back hit when the hit travels the way the victim faces", () => {
    expect(zone({ x: 1, y: 0 }, 1)).toBe("back");
    expect(zone({ x: -1, y: 0 }, -1)).toBe("back");
  });

  it("should be a front hit when the victim faces the attacker", () => {
    expect(zone({ x: 1, y: 0 }, -1)).toBe("front");
    expect(zone({ x: -1, y: 0 }, 1)).toBe("front");
  });

  it("should be a front hit when the hit comes straight from above or below", () => {
    expect(zone({ x: 0, y: 1 }, 1)).toBe("front");
    expect(zone({ x: 0, y: -1 }, -1)).toBe("front");
  });

  it("should be a back hit when a diagonal hit comes from behind", () => {
    expect(zone({ x: Math.SQRT1_2, y: Math.SQRT1_2 }, 1)).toBe("back");
  });
});

describe("hitDamage", () => {
  it("should take the damage per zone from the tunables", () => {
    expect(hitDamage("front", D)).toBe(D.frontHitDamage);
    expect(hitDamage("back", D)).toBe(D.backHitDamage);
    expect(D.frontHitDamage).toBe(1);
    expect(D.backHitDamage).toBe(2);
  });

  it("should support the bounce-only front variant when front damage is 0 and back is 4", () => {
    const variant = { frontHitDamage: 0, backHitDamage: 4 };
    expect(hitDamage("front", variant)).toBe(0);
    expect(hitDamage("back", variant)).toBe(4);
  });
});
