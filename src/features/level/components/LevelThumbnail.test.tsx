import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LevelThumbnail } from "@/features/level/components/LevelThumbnail";
import type { LevelDefinition } from "@/features/level/types/levelDefinition.types";
import { GAME_PALETTE, terrainSwatch, toCssColor } from "@/shared/config/gamePalette";

const level: LevelDefinition = {
  formatVersion: 2,
  meta: { levelId: "tiny", title: "Tiny Test" },
  settings: { cellSize: 4, gravity: 1 },
  worldSize: { w: 1600, h: 1000 },
  terrain: [
    {
      shape: { type: "rect", x: 400, y: 640, w: 800, h: 64 },
      materialId: "stone",
      colorId: "mint",
    },
    {
      shape: {
        type: "polygon",
        points: [
          { x: 480, y: 704 },
          { x: 1120, y: 704 },
          { x: 800, y: 800 },
        ],
      },
      materialId: "stone",
      colorId: "plum",
    },
    {
      shape: { type: "circle", cx: 800, cy: 300, r: 28 },
      materialId: "earth",
      colorId: "no-such-colour",
    },
  ],
  spawns: [
    { x: 480, y: 616 },
    { x: 1120, y: 616 },
  ],
  drops: [],
  collectibles: [],
  bounds: { x: 40, y: 20, w: 1520, h: 960 },
};

const viewBoxOf = (svg: Element): number[] =>
  (svg.getAttribute("viewBox") ?? "").split(" ").map(Number);

describe("LevelThumbnail", () => {
  it("should draw one shape per terrain piece when given a level", () => {
    render(<LevelThumbnail level={level} />);
    const svg = screen.getByRole("img", { name: "Layout of Tiny Test" });
    expect(svg.querySelectorAll("[data-terrain]")).toHaveLength(3);
    expect(svg.querySelector("rect[data-terrain]")).not.toBeNull();
    expect(svg.querySelector("polygon[data-terrain]")?.getAttribute("points")).toBe(
      "480,704 1120,704 800,800"
    );
    expect(svg.querySelector("circle[data-terrain]")).not.toBeNull();
  });

  it("should frame the view to the level bounds when rendered", () => {
    render(<LevelThumbnail level={level} />);
    const [x, y, w, h] = viewBoxOf(screen.getByRole("img"));
    const b = level.bounds;
    expect(w / h).toBeCloseTo(16 / 10);
    expect(x).toBeLessThan(b.x);
    expect(y).toBeLessThan(b.y);
    expect(x + w).toBeGreaterThan(b.x + b.w);
    expect(y + h).toBeGreaterThan(b.y + b.h);
  });

  it("should fill each piece with its swatch and fall back when the colour is unknown", () => {
    render(<LevelThumbnail level={level} />);
    const pieces = screen.getByRole("img").querySelectorAll<SVGElement>("[data-terrain]");
    const fillOf = (el: SVGElement | undefined) => el?.style.fill ?? "";
    const asRgb = (hex: number) => {
      const probe = document.createElement("div");
      probe.style.color = toCssColor(hex);
      return probe.style.color;
    };
    expect(fillOf(pieces[0])).toBe(asRgb(terrainSwatch("mint").fill));
    expect(fillOf(pieces[1])).toBe(asRgb(terrainSwatch("plum").fill));
    expect(fillOf(pieces[2])).toBe(asRgb(GAME_PALETTE.fallbackSwatch.fill));
  });
});
