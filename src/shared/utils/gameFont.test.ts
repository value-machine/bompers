import { describe, expect, it } from "vitest";
import { waitForGameFont } from "@/shared/utils/gameFont";

describe("waitForGameFont", () => {
  it("should resolve true when the font face loads", async () => {
    await expect(waitForGameFont(1000, { load: () => Promise.resolve([{}]) })).resolves.toBe(true);
  });

  it("should resolve false when the font never loads within the timeout", async () => {
    await expect(waitForGameFont(10, { load: () => new Promise(() => {}) })).resolves.toBe(false);
  });

  it("should resolve false when loading fails or matches no face", async () => {
    await expect(
      waitForGameFont(1000, { load: () => Promise.reject(new Error("x")) })
    ).resolves.toBe(false);
    await expect(waitForGameFont(1000, { load: () => Promise.resolve([]) })).resolves.toBe(false);
  });

  it("should resolve false when there is no font API", async () => {
    await expect(waitForGameFont(1000, null)).resolves.toBe(false);
  });
});
