import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GamePage } from "./GamePage";

// Pixi needs WebGL/WebGPU, which jsdom lacks; the page test checks the shell only.
vi.mock("@/shared/hooks/usePixiApp", () => ({ usePixiApp: () => null }));

describe("GamePage", () => {
  it("should render the canvas host and the controls hint when the page opens", () => {
    render(<GamePage />);
    expect(screen.getByTestId("game-canvas-host")).toBeInTheDocument();
    expect(screen.getByText(/A\/D move/)).toBeInTheDocument();
  });
});
