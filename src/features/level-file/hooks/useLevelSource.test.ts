import { readFileSync } from "node:fs";
import path from "node:path";
import { act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "tests/test-utils";
import { useLevelSource } from "@/features/level-file/hooks/useLevelSource";

const BUILT_IN = readFileSync(path.join(process.cwd(), "public/levels/start-arena.html"), "utf8");
const levelFile = (text: string, name = "my-level.html"): File =>
  new File([text], name, { type: "text/html" });

describe("useLevelSource", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(BUILT_IN, { status: 200 })))
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("should play the built-in level file when nothing was imported", async () => {
    const { result } = renderHookWithProviders(() => useLevelSource(), { withRouter: false });
    await waitFor(() => expect(result.current.level?.meta.levelId).toBe("start-arena"));
    expect(fetch).toHaveBeenCalledWith("/levels/start-arena.html");
  });

  it("should switch to a new level object when a valid file is imported (even the same file)", async () => {
    const { result } = renderHookWithProviders(() => useLevelSource(), { withRouter: false });
    await waitFor(() => expect(result.current.level).not.toBeNull());
    const builtIn = result.current.level;
    const renamed = BUILT_IN.replace('data-title="Start Arena"', 'data-title="Mine"');
    await act(() => result.current.importFile(levelFile(renamed)));
    const first = result.current.level;
    expect(first?.meta.title).toBe("Mine");
    expect(first).not.toBe(builtIn);
    expect(result.current.report).toEqual({
      fileName: "my-level.html",
      ok: true,
      errors: [],
      warnings: [],
    });
    await act(() => result.current.importFile(levelFile(renamed)));
    expect(result.current.level).not.toBe(first);
  });

  it("should keep the current level and report errors when the file is rejected", async () => {
    const { result } = renderHookWithProviders(() => useLevelSource(), { withRouter: false });
    await waitFor(() => expect(result.current.level).not.toBeNull());
    const before = result.current.level;
    await act(() => result.current.importFile(levelFile("<p>not a level</p>", "notes.html")));
    expect(result.current.level).toBe(before);
    expect(result.current.report?.ok).toBe(false);
    expect(result.current.report?.errors[0]?.code).toBe("E1");
    act(() => result.current.dismissReport());
    expect(result.current.report).toBeNull();
  });

  it("should expose a load error when the built-in level can't be fetched", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("", { status: 404 })))
    );
    const { result } = renderHookWithProviders(() => useLevelSource(), { withRouter: false });
    await waitFor(() => expect(result.current.loadError).toContain("HTTP 404"));
    expect(result.current.level).toBeNull();
  });
});
