import { describe, expect, it } from "vitest";
import {
  createBrowserLevelStore,
  createMemoryLevelStore,
} from "@/features/level-memory/services/levelStore";
import type { LevelRecord } from "@/features/level-memory/types/levelMemory.types";

const record = (levelId: string, savedAt: number, text = "<svg/>"): LevelRecord => ({
  levelId,
  fileName: `${levelId}.html`,
  text,
  lastModified: savedAt,
  savedAt,
});

describe("createMemoryLevelStore", () => {
  it("should keep one record per level id, newest text, in save order when records are put", async () => {
    const store = createMemoryLevelStore();
    await store.put(record("b", 2));
    await store.put(record("a", 1));
    await store.put(record("b", 2, "<svg id='v2'/>"));
    const all = await store.list();
    expect(all.map((r) => r.levelId)).toEqual(["a", "b"]);
    expect(all[1]?.text).toBe("<svg id='v2'/>");
  });

  it("should drop the record when it is removed", async () => {
    const store = createMemoryLevelStore([record("a", 1)]);
    await store.remove("a");
    expect(await store.list()).toEqual([]);
  });
});

describe("createBrowserLevelStore", () => {
  it("should fall back to memory when IndexedDB is not available", async () => {
    // jsdom has no IndexedDB, like a browser with blocked site data.
    const store = createBrowserLevelStore();
    await store.put(record("a", 1));
    expect((await store.list()).map((r) => r.levelId)).toEqual(["a"]);
  });
});
