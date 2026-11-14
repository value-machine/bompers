import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "tests/test-utils";
import { GamePage } from "./GamePage";

// Pixi needs WebGL/WebGPU, which jsdom lacks; the page test checks the shell only.
vi.mock("@/shared/hooks/usePixiApp", () => ({ usePixiApp: () => null }));

const level = (url: string): string =>
  readFileSync(path.join(process.cwd(), "public", url), "utf8");

/** Runs queued animation frames (the lobby polls input once per frame). */
const nextFrame = async (): Promise<void> => {
  await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
};

const tap = async (code: string): Promise<void> => {
  fireEvent.keyDown(window, { code });
  await nextFrame();
  fireEvent.keyUp(window, { code });
  await nextFrame();
};

describe("GamePage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => Promise.resolve(new Response(level(url), { status: 200 })))
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("should open on the lobby with four empty slots and the first built-in level", async () => {
    renderWithProviders(<GamePage />, { withRouter: false });
    expect(screen.getByRole("heading", { name: /who's playing/i })).toBeInTheDocument();
    expect(screen.getAllByText(/to join/).length).toBeGreaterThan(0);
    expect(await screen.findByText("Start Arena")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /load level/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /join to start/i })).toBeDisabled();
  });

  it("should join two keyboard players and start the match when the first confirms again", async () => {
    renderWithProviders(<GamePage />, { withRouter: false });
    await screen.findByText("Start Arena");
    await tap("Space");
    await tap("Enter");
    expect(screen.getByTestId("player-slot-0")).toHaveAttribute("data-joined", "true");
    expect(screen.getByTestId("player-slot-1")).toHaveAttribute("data-joined", "true");
    await tap("KeyF");
    expect(screen.getByTestId("game-canvas-host")).toBeInTheDocument();
    expect(screen.queryByTestId("lobby-screen")).not.toBeInTheDocument();
  });
});
