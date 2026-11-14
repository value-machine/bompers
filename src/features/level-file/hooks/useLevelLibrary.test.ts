import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "tests/test-utils";
import { useLevelLibrary } from "@/features/level-file/hooks/useLevelLibrary";
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

const renderLibrary = () => renderHookWithProviders(() => useLevelLibrary(), { withRouter: false });

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
    ]);
  });

  it("should add a new entry for every valid import (even the same file) when files are imported", async () => {
    const { result } = renderLibrary();
    await waitFor(() => expect(result.current.entries[0]?.level).not.toBeNull());
    const renamed = START_ARENA.replace('data-title="Start Arena"', 'data-title="Mine"');
    let firstId: string | null = null;
    await act(async () => {
      firstId = await result.current.importFile(levelFile(renamed));
    });
    expect(firstId).toBe("import:1");
    const added = result.current.entries.find((e) => e.id === firstId);
    expect(added).toMatchObject({ origin: "imported", error: null });
    expect(added?.level?.meta.title).toBe("Mine");
    expect(result.current.report).toEqual({
      fileName: "my-level.html",
      ok: true,
      errors: [],
      warnings: [],
    });
    await act(() => result.current.importFile(levelFile(renamed)));
    expect(result.current.entries.map((e) => e.id).slice(-2)).toEqual(["import:1", "import:2"]);
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
