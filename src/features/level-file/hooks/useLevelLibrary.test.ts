import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "tests/test-utils";
import { useLevelLibrary } from "@/features/level-file/hooks/useLevelLibrary";
import {
  createMemoryLevelStore,
  type LevelStore,
} from "@/features/level-memory/api/levelMemoryApi";
import { BUILT_IN_LEVEL_FILES } from "@/features/level-file/services/levelFileSource";

const LEVELS_DIR = path.join(process.cwd(), "public/levels");
const readLevel = (name: string): string => readFileSync(path.join(LEVELS_DIR, name), "utf8");
const START_ARENA = readLevel("start-arena.html");
const levelFile = (text: string, name = "my-level.html"): File =>
  new File([text], name, { type: "text/html" });

/** Serves every file in public/levels/ by its URL, like the dev server. */
const serveLevels = (url: string): Promise<Response> => {
  const name = url.replace("/levels/", "");
  const files = readdirSync(LEVELS_DIR);
  return Promise.resolve(
    files.includes(name)
      ? new Response(readLevel(name), { status: 200 })
      : new Response("", { status: 404 })
  );
};

const renderLibrary = (store: LevelStore = createMemoryLevelStore()) =>
  renderHookWithProviders(() => useLevelLibrary({ store }), { withRouter: false });

const MINE = START_ARENA.replace('data-title="Start Arena"', 'data-title="Mine"').replace(
  /data-level-id="[^"]*"/,
  'data-level-id="mine"'
);
const lastEntry = <T>(list: readonly T[]): T | undefined => list[list.length - 1];
const withTitle = (title: string): string =>
  MINE.replace('data-title="Mine"', `data-title="${title}"`);

describe("useLevelLibrary", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(serveLevels));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("should list exactly the level files in public/levels when reading the manifest", () => {
    expect([...BUILT_IN_LEVEL_FILES].sort()).toEqual(readdirSync(LEVELS_DIR).sort());
    expect(BUILT_IN_LEVEL_FILES[0]).toBe("start-arena.html");
  });

  it("should load every built-in level with its title and author when the library opens", async () => {
    const { result } = renderLibrary();
    await waitFor(() => expect(result.current.entries.every((e) => e.level)).toBe(true));
    const metas = result.current.entries.map((e) => [
      e.id,
      e.level?.meta.title,
      e.level?.meta.author,
    ]);
    expect(metas).toEqual([
      ["/levels/start-arena.html", "Start Arena", "Bompers team"],
      ["/levels/floating-garden.html", "Floating Garden", "Bompers team"],
      ["/levels/bobsled-run.html", "Bobsled Run", "Bompers team"],
      ["/levels/piston-works.html", "Piston Works", "Bompers team"],
      ["/levels/bonfire-bridge.html", "Bonfire Bridge", "Bompers team"],
      ["/levels/crystal-gap.html", "Crystal Gap", "Bompers team"],
      ["/levels/slush-bowl.html", "Slush Bowl", "Bompers team"],
      ["/levels/tree-grove.html", "Tree Grove", "Bompers team"],
      ["/levels/beach-court.html", "Beach Court", "Bompers team"],
      ["/levels/ball-playground.html", "Ball Playground", "Bompers team"],
    ]);
  });
});

describe("useLevelLibrary imports", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(serveLevels));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("should add an imported level and report it when a valid file is imported", async () => {
    const { result } = renderLibrary();
    await waitFor(() => expect(result.current.entries[0]?.level).not.toBeNull());
    let id: string | null = null;
    await act(async () => {
      id = await result.current.importFile(levelFile(MINE));
    });
    const added = result.current.entries.find((e) => e.id === id);
    expect(added).toMatchObject({ origin: "imported", error: null, memory: "copy" });
    expect(added?.level?.meta.title).toBe("Mine");
    expect(result.current.report).toEqual({
      fileName: "my-level.html",
      ok: true,
      errors: [],
      warnings: [],
    });
  });

  it("should replace the entry in place when a file with the same level id is imported", async () => {
    const { result } = renderLibrary();
    await waitFor(() => expect(result.current.entries[0]?.level).not.toBeNull());
    await act(() => result.current.importFile(levelFile(MINE)));
    await act(() => result.current.importFile(levelFile(withTitle("Mine v2"))));
    const imported = result.current.entries.filter((e) => e.origin === "imported");
    expect(imported).toHaveLength(1);
    expect(imported[0]?.level?.meta.title).toBe("Mine v2");
  });

  it("should keep an imported level when the library is created again with the same store", async () => {
    const store = createMemoryLevelStore();
    const first = renderLibrary(store);
    await act(() => first.result.current.importFile(levelFile(MINE)));
    first.unmount();
    const { result } = renderLibrary(store);
    await waitFor(() =>
      expect(result.current.entries.find((e) => e.origin === "imported")?.level?.meta.title).toBe(
        "Mine"
      )
    );
  });

  it("should drop the level from the library and the store when it is forgotten", async () => {
    const store = createMemoryLevelStore();
    const { result } = renderLibrary(store);
    let id: string | null = null;
    await act(async () => {
      id = await result.current.importFile(levelFile(MINE));
    });
    await act(() => result.current.forget(id ?? ""));
    expect(result.current.entries.some((e) => e.origin === "imported")).toBe(false);
    expect(await store.list()).toEqual([]);
  });

  it("should re-read a linked level when the window regains focus after the file changed", async () => {
    let current = { text: MINE, lastModified: 1 };
    const handle = {
      kind: "file",
      name: "mine.html",
      queryPermission: () => Promise.resolve("granted"),
      getFile: () =>
        Promise.resolve(
          new File([current.text], "mine.html", { lastModified: current.lastModified })
        ),
    } as unknown as FileSystemFileHandle;
    const { result } = renderLibrary();
    await act(async () => {
      await result.current.importFile(await handle.getFile(), handle);
    });
    expect(lastEntry(result.current.entries)?.memory).toBe("linked");
    current = { text: withTitle("Edited on disk"), lastModified: 2 };
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    await waitFor(() => expect(lastEntry(result.current.entries)?.memory).toBe("updated"));
    expect(lastEntry(result.current.entries)?.level?.meta.title).toBe("Edited on disk");
  });

  it("should add nothing and report errors when the file is rejected", async () => {
    const { result } = renderLibrary();
    await waitFor(() => expect(result.current.entries[0]?.level).not.toBeNull());
    let id: string | null = "unset";
    await act(async () => {
      id = await result.current.importFile(levelFile("<p>not a level</p>", "notes.html"));
    });
    expect(id).toBeNull();
    expect(result.current.entries).toHaveLength(BUILT_IN_LEVEL_FILES.length);
    expect(result.current.report?.errors[0]?.code).toBe("E1");
    act(() => result.current.dismissReport());
    expect(result.current.report).toBeNull();
  });

  it("should expose a per-level error when a built-in level can't be fetched", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("", { status: 404 })))
    );
    const { result } = renderLibrary();
    await waitFor(() => expect(result.current.entries[0]?.error).toContain("HTTP 404"));
    expect(result.current.entries[0]?.level).toBeNull();
  });
});
