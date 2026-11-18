import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ALL_WEAPON_ITEM_IDS } from "@/shared/config/weaponItems";
import { GAME_PALETTE, toCssColor, weaponLook } from "@/shared/config/gamePalette";
import { WeaponCrateIcon } from "@/features/lobby/components/WeaponCrateIcon";

describe("WeaponCrateIcon", () => {
  it.each(ALL_WEAPON_ITEM_IDS)(
    "should draw the %s crate in its accent with a finite mouth mark when rendered",
    (weaponId) => {
      const { container } = render(<WeaponCrateIcon weaponId={weaponId} />);
      const box = container.querySelector("svg > rect");
      expect(box?.getAttribute("fill")).toBe(toCssColor(weaponLook(weaponId).accent));
      expect(box?.getAttribute("stroke")).toBe(toCssColor(GAME_PALETTE.ink));
      const mark = container.querySelectorAll("svg > g rect, svg > g polygon");
      expect(mark.length).toBeGreaterThan(0);
      expect(container.innerHTML).not.toContain("NaN");
    }
  );
});
