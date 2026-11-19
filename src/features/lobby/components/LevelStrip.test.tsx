import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LevelLibraryEntry } from "@/features/level-file/api/levelFileApi";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import { LevelStrip } from "@/features/lobby/components/LevelStrip";

const level = (title: string): LevelDefinition => ({
  formatVersion: 2,
  meta: { levelId: title.toLowerCase(), title },
  settings: { cellSize: 4, gravity: 1 },
  worldSize: { w: 1600, h: 1000 },
  terrain: [{ shape: { type: "rect", x: 0, y: 800, w: 1600, h: 64 }, materialId: "stone" }],
  spawns: [],
  drops: [],
  collectibles: [],
  bounds: { x: 0, y: 0, w: 1600, h: 1000 },
});

const entries: LevelLibraryEntry[] = [
  { id: "/levels/a.html", origin: "built-in", level: level("Arena"), error: null },
  { id: "/levels/b.html", origin: "built-in", level: null, error: "HTTP 404" },
  { id: "import:mine", origin: "imported", level: level("Mine"), error: null, memory: "linked" },
];

describe("LevelStrip", () => {
  it("should show a card per playable level, the chip on imports, and a load card", () => {
    render(
      <LevelStrip entries={entries} selectedId="import:mine" onSelect={vi.fn()} onLoad={vi.fn()} />
    );
    expect(screen.getByRole("img", { name: "Layout of Arena" })).toBeInTheDocument();
    expect(screen.queryByTestId("lobby-level-card-/levels/b.html")).toBeNull();
    expect(screen.getByTestId("lobby-level-chip-import:mine")).toHaveTextContent("Linked");
    expect(screen.getByTestId("lobby-level-card-import:mine")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: /load level/i })).toBeInTheDocument();
  });

  it("should scroll inside the strip and keep the picked card in view when the library is long", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const many: LevelLibraryEntry[] = Array.from({ length: 30 }, (_, index) => ({
      id: `import:${index}`,
      origin: "imported",
      level: level(`Level ${index}`),
      error: null,
      memory: "copy",
    }));
    render(
      <LevelStrip entries={many} selectedId="import:29" onSelect={vi.fn()} onLoad={vi.fn()} />
    );
    const strip = screen.getByTestId("lobby-level-strip");
    // The strip is the scroll container and its cards never size it (no page-wide overflow).
    expect(strip).toHaveClass("overflow-x-auto", "contain-inline-size", "w-full");
    expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ inline: "center" }));
    expect(scrollIntoView.mock.contexts[0]).toBe(screen.getByTestId("lobby-level-card-import:29"));
  });

  it("should pick a level when its card is clicked and open the picker from the load card", () => {
    const onSelect = vi.fn();
    const onLoad = vi.fn();
    render(
      <LevelStrip entries={entries} selectedId="import:mine" onSelect={onSelect} onLoad={onLoad} />
    );
    fireEvent.click(screen.getByTestId("lobby-level-card-/levels/a.html"));
    fireEvent.click(screen.getByTestId("lobby-level-card-load"));
    expect(onSelect).toHaveBeenCalledWith("/levels/a.html");
    expect(onLoad).toHaveBeenCalledTimes(1);
  });
});
