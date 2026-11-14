import { describe, expect, it } from "vitest";
import {
  CONTENT_CATALOG,
  exportCatalog,
  resolveCatalogEntry,
} from "@/features/content-catalog/services/contentCatalog";

describe("contentCatalog", () => {
  it("should resolve a known material when the ID exists", () => {
    const resolved = resolveCatalogEntry("material", "dirt");
    expect(resolved.fallback).toBe(false);
    expect(resolved.entry?.destructible).toBe(true);
  });

  it("should fall back to stone and flag it when a material ID is unknown", () => {
    const resolved = resolveCatalogEntry("material", "lava");
    expect(resolved).toMatchObject({ fallback: true, entry: { id: "stone" } });
  });

  it("should resolve to no entry when an unknown kind has no fallback", () => {
    expect(resolveCatalogEntry("behavior", "spin")).toEqual({ entry: null, fallback: true });
  });

  it("should not treat object prototype keys as catalog IDs", () => {
    expect(resolveCatalogEntry("material", "toString").fallback).toBe(true);
  });

  it("should export plain JSON that round-trips and lists every starter ID", () => {
    const exported = exportCatalog();
    expect(JSON.parse(JSON.stringify(exported))).toEqual(exported);
    expect(exported.entries.material.map((m) => m.id)).toEqual(["stone", "dirt"]);
    expect(exported.entries.item.map((i) => i.id)).toEqual(["rocket-launcher", "point-orb"]);
    exported.entries.material[0]!.name = "changed";
    expect(CONTENT_CATALOG.material.stone?.name).toBe("Stone");
  });

  it("should key every entry by its own ID", () => {
    for (const entries of Object.values(CONTENT_CATALOG)) {
      for (const [key, entry] of Object.entries(entries)) expect(entry.id).toBe(key);
    }
  });
});
