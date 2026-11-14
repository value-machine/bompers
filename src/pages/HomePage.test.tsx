import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { HomePage } from "./HomePage";
import { renderWithProviders } from "tests/test-utils";

describe("HomePage", () => {
  it("should show the harness overview card when the page renders", () => {
    renderWithProviders(<HomePage />);

    expect(screen.getByRole("link", { name: /how the harness works/i })).toBeInTheDocument();
  });
});
