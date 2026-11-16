import { act, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useClipboardCopy } from "@/features/level-kit/hooks/useClipboardCopy";
import { renderHookWithProviders } from "tests/test-utils";

const stubClipboard = (writeText: (text: string) => Promise<void>): void => {
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
};

describe("useClipboardCopy", () => {
  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
  });

  it("should write the text and report copied when the clipboard accepts it", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    stubClipboard(writeText);
    const { result } = renderHookWithProviders(() => useClipboardCopy(() => "prompt text"));
    act(() => result.current.copy());
    await waitFor(() => expect(result.current.status).toBe("copied"));
    expect(writeText).toHaveBeenCalledWith("prompt text");
  });

  it("should report failed when the clipboard rejects the write", async () => {
    stubClipboard(() => Promise.reject(new Error("denied")));
    const { result } = renderHookWithProviders(() => useClipboardCopy(() => "x"));
    act(() => result.current.copy());
    await waitFor(() => expect(result.current.status).toBe("failed"));
  });

  it("should report failed when the browser has no clipboard", () => {
    const { result } = renderHookWithProviders(() => useClipboardCopy(() => "x"));
    act(() => result.current.copy());
    expect(result.current.status).toBe("failed");
  });
});
