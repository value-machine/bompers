import { describe, expect, it } from "vitest";
import { contactShadow } from "@/shared/utils/contactShadow";

describe("contactShadow", () => {
  it("should be full size and alpha when the object touches the ground", () => {
    expect(contactShadow(0, 20)).toEqual({ width: 21, height: 12, alpha: 0.28 });
  });

  it("should be half size and faded out when the object is at the range limit", () => {
    const shadow = contactShadow(240, 20);
    expect(shadow?.width).toBeCloseTo(10.5);
    expect(shadow?.height).toBeCloseTo(6);
    expect(shadow?.alpha).toBeCloseTo(0);
  });

  it("should be null when no surface is within range", () => {
    expect(contactShadow(241, 20)).toBeNull();
    expect(contactShadow(-1, 20)).toBeNull();
  });
});
