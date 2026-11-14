import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "tests/test-utils";
import { GamePage } from "./GamePage";

// Pixi needs WebGL/WebGPU, which jsdom lacks; the page test checks the shell only.
vi.mock("@/shared/hooks/usePixiApp", () => ({ usePixiApp: () => null }));

const BUILT_IN = readFileSync(path.join(process.cwd(), "public/levels/start-arena.html"), "utf8");

describe("GamePage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(BUILT_IN, { status: 200 })))
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("should render the canvas host, the controls hint and the Load level button when the page opens", () => {
    renderWithProviders(<GamePage />, { withRouter: false });
    expect(screen.getByTestId("game-canvas-host")).toBeInTheDocument();
    expect(screen.getByText(/A\/D move/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /load level/i })).toBeInTheDocument();
  });
});
