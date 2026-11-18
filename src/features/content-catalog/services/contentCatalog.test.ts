import { describe, expect, it } from "vitest";
import {
  CONTENT_CATALOG,
  exportCatalog,
  itemUseOf,
  resolveCatalogEntry,
} from "@/features/content-catalog/services/contentCatalog";

describe("contentCatalog", () => {
  it("should resolve a known material when the ID exists", () => {
    const resolved = resolveCatalogEntry("material", "earth");
    expect(resolved.isFallback).toBe(false);
    expect(resolved.entry?.toughness).toBe(1);
  });

  it("should make cardboard softer than earth and stone and ice unbreakable when toughness is read", () => {
    const toughness = (id: string): number | null | undefined =>
      resolveCatalogEntry("material", id).entry?.toughness;
    expect(toughness("cardboard")).toBe(0.7);
    expect(toughness("earth")).toBe(1);
    expect(toughness("stone")).toBeNull();
    expect(toughness("ice")).toBeNull();
  });

  it("should fall back to stone and flag it when a material ID is unknown", () => {
    const resolved = resolveCatalogEntry("material", "lava");
    expect(resolved).toMatchObject({ isFallback: true, entry: { id: "stone" } });
  });

  it("should resolve to no entry when an unknown kind has no fallback", () => {
    expect(resolveCatalogEntry("behavior", "spin")).toEqual({ entry: null, isFallback: true });
  });

  it("should give each item's point role and null when the ID is not an item", () => {
    expect(itemUseOf("rocket-launcher")).toBe("drop");
    expect(itemUseOf("dive-reset")).toBe("collectible");
    expect(itemUseOf("stone")).toBeNull();
    expect(itemUseOf("toString")).toBeNull();
  });

  it("should not treat object prototype keys as catalog IDs", () => {
    expect(resolveCatalogEntry("material", "toString").isFallback).toBe(true);
  });

  it("should export plain JSON in the kit catalog shape with every starter ID", () => {
    const exported = exportCatalog();
    expect(JSON.parse(JSON.stringify(exported))).toEqual(exported);
    expect(exported.formatVersion).toBe(2);
    expect(exported.defaults.material).toBe("stone");
    expect(exported.defaults.items).toEqual({
      collectible: "point-orb",
    });
    expect(exported.material.map((m) => m.id)).toEqual(["stone", "earth", "cardboard", "ice"]);
    expect(exported.color.map((c) => c.id)).toContain("plum");
    expect(exported.item.map((i) => i.id)).toEqual([
      "rocket-launcher",
      "homing-launcher",
      "torch",
      "freeze-ray",
      "point-orb",
      "dive-reset",
    ]);
    // Fire flags (fire-spread b1): only cardboard burns, only ice douses.
    expect(exported.material.filter((m) => m.burns).map((m) => m.id)).toEqual(["cardboard"]);
    expect(exported.material.filter((m) => m.douses).map((m) => m.id)).toEqual(["ice"]);
    expect(exported.behavior).toEqual([]);
    exported.material[0]!.label = "changed";
    expect(CONTENT_CATALOG.material.stone?.label).toBe("Stone");
  });

  it("should key every entry by a kebab-case ID equal to its key", () => {
    for (const entries of Object.values(CONTENT_CATALOG)) {
      for (const [key, entry] of Object.entries(entries)) {
        expect(entry.id).toBe(key);
        expect(key).toMatch(/^[a-z][a-z0-9-]{0,63}$/);
      }
    }
  });

  it("should only reference effect, sound and colour IDs that exist when a material names defaults", () => {
    for (const material of Object.values(CONTENT_CATALOG.material)) {
      expect(resolveCatalogEntry("color", material.defaultColor).isFallback).toBe(false);
      expect(resolveCatalogEntry("effect", material.effect).isFallback).toBe(false);
      expect(resolveCatalogEntry("sound", material.sound).isFallback).toBe(false);
    }
  });
});
